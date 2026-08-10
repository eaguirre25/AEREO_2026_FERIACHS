#!/usr/bin/env python3
"""Build the browser Cessna asset from the FlightGear c172p AC3D source.

Requires: Pillow, NumPy and trimesh. The source checkout must be the GPL-2.0
c172p-team/c172p repository. Only exterior groups are retained.
"""

from __future__ import annotations

import argparse
import re
import shlex
import shutil
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from PIL import Image
import trimesh


EXTERIOR_GROUPS = {
    "antennas",
    "BeaconOff",
    "BeaconOffX",
    "doors",
    "fuselage_1",
    "prop",
    "rudder",
    "transperant",
    "vstab",
    "wing",
}
SKIPPED_OBJECTS = {"Propeller.Fast", "PropellerCowlPlugs"}
TEXTURES = {
    "fuselage.png",
    "glass-alpha.png",
    "lights.png",
    "prop.png",
    "tail.png",
    "wing.png",
}


@dataclass
class Material:
    name: str
    color: tuple[float, float, float]
    transparency: float


@dataclass
class Surface:
    material: int = 0
    refs: list[tuple[int, float, float]] = field(default_factory=list)


@dataclass
class Node:
    kind: str
    name: str = ""
    texture: str | None = None
    rotation: np.ndarray = field(default_factory=lambda: np.eye(3))
    location: np.ndarray = field(default_factory=lambda: np.zeros(3))
    vertices: list[tuple[float, float, float]] = field(default_factory=list)
    surfaces: list[Surface] = field(default_factory=list)
    children: list["Node"] = field(default_factory=list)
    start: int = 0
    end: int = 0


class AC3DParser:
    def __init__(self, path: Path):
        self.path = path
        self.lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        self.index = 0
        self.materials: list[Material] = []

    def parse(self) -> Node:
        if not self.lines or not self.lines[0].startswith("AC3D"):
            raise ValueError(f"{self.path} no es un archivo AC3D válido")
        self.index = 1
        while self.index < len(self.lines) and self.lines[self.index].startswith("MATERIAL "):
            self.materials.append(parse_material(self.lines[self.index]))
            self.index += 1
        return self._node()

    def _node(self) -> Node:
        start = self.index
        line = self.lines[self.index]
        if not line.startswith("OBJECT "):
            raise ValueError(f"Se esperaba OBJECT en la línea {self.index + 1}")
        node = Node(kind=line.split(maxsplit=1)[1], start=start)
        self.index += 1

        while self.index < len(self.lines):
            line = self.lines[self.index]
            if line.startswith("name "):
                node.name = shlex.split(line)[1]
                self.index += 1
            elif line.startswith("texture "):
                node.texture = Path(shlex.split(line)[1]).name
                self.index += 1
            elif line.startswith("rot "):
                node.rotation = np.array([float(value) for value in line.split()[1:]], dtype=float).reshape(3, 3)
                self.index += 1
            elif line.startswith("loc "):
                node.location = np.array([float(value) for value in line.split()[1:4]], dtype=float)
                self.index += 1
            elif line.startswith("data "):
                size = int(line.split()[1])
                self.index += 1
                consumed = 0
                while consumed < size and self.index < len(self.lines):
                    consumed += len(self.lines[self.index]) + 1
                    self.index += 1
            elif line.startswith("numvert "):
                count = int(line.split()[1])
                self.index += 1
                node.vertices = [
                    tuple(float(value) for value in self.lines[self.index + offset].split()[:3])
                    for offset in range(count)
                ]
                self.index += count
            elif line.startswith("numsurf "):
                count = int(line.split()[1])
                self.index += 1
                node.surfaces = [self._surface() for _ in range(count)]
            elif line.startswith("kids "):
                count = int(line.split()[1])
                self.index += 1
                node.children = [self._node() for _ in range(count)]
                node.end = self.index
                return node
            else:
                self.index += 1
        raise ValueError(f"El objeto {node.name!r} no tiene declaración kids")

    def _surface(self) -> Surface:
        if not self.lines[self.index].startswith("SURF "):
            raise ValueError(f"Se esperaba SURF en la línea {self.index + 1}")
        self.index += 1
        surface = Surface()
        while self.index < len(self.lines):
            line = self.lines[self.index]
            if line.startswith("mat "):
                surface.material = int(line.split()[1])
                self.index += 1
            elif line.startswith("refs "):
                count = int(line.split()[1])
                self.index += 1
                surface.refs = []
                for offset in range(count):
                    values = self.lines[self.index + offset].split()
                    surface.refs.append((int(values[0]), float(values[1]), float(values[2])))
                self.index += count
                return surface
            else:
                self.index += 1
        raise ValueError("Superficie AC3D incompleta")


def parse_material(line: str) -> Material:
    tokens = shlex.split(line)
    rgb_index = tokens.index("rgb")
    trans_index = tokens.index("trans")
    return Material(
        name=tokens[1],
        color=tuple(float(value) for value in tokens[rgb_index + 1:rgb_index + 4]),
        transparency=float(tokens[trans_index + 1]),
    )


def local_matrix(node: Node) -> np.ndarray:
    matrix = np.eye(4)
    matrix[:3, :3] = node.rotation
    matrix[:3, 3] = node.location
    return matrix


def ac3d_to_web(vector: np.ndarray) -> np.ndarray:
    """FlightGear AC3D (-X forward, Y up, Z right) to Three.js axes."""
    return np.array([-vector[0], vector[2], vector[1]], dtype=float)


def walk(node: Node, parent_matrix: np.ndarray, top_group: str | None = None):
    matrix = parent_matrix @ local_matrix(node)
    selected_group = node.name if top_group is None and node.kind != "world" else top_group
    yield node, matrix, selected_group
    for child in node.children:
        yield from walk(child, matrix, selected_group)


def optimize_texture(source: Path, destination: Path) -> None:
    with Image.open(source) as image:
        image.load()
        if max(image.size) > 1024:
            image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        image.save(destination, optimize=True)


def write_filtered_source(parser: AC3DParser, root: Node, destination: Path) -> None:
    header = parser.lines[:root.start]
    selected = [child for child in root.children if child.name in EXTERIOR_GROUPS]
    root_prefix = parser.lines[root.start:]
    kids_offset = next(index for index, line in enumerate(root_prefix) if line.startswith("kids "))
    output = header + root_prefix[:kids_offset] + [f"kids {len(selected)}"]
    for child in selected:
        output.extend(parser.lines[child.start:child.end])
    destination.write_text("\n".join(output) + "\n", encoding="utf-8")


def build_scene(root: Node, materials: list[Material], texture_dir: Path) -> trimesh.Scene:
    buckets: dict[tuple[str, int, str | None], dict[str, list]] = {}
    identity = np.eye(4)

    for node, matrix, top_group in walk(root, identity):
        if top_group not in EXTERIOR_GROUPS or node.kind != "poly":
            continue
        if node.name in SKIPPED_OBJECTS or not node.vertices:
            continue

        transformed = []
        for vertex in node.vertices:
            world = matrix @ np.array([*vertex, 1.0])
            transformed.append(ac3d_to_web(world[:3]))

        for surface in node.surfaces:
            if len(surface.refs) < 3:
                continue
            group = "propeller" if node.name == "Propeller" else "aircraft"
            key = (group, surface.material, node.texture)
            bucket = buckets.setdefault(key, {"vertices": [], "uv": [], "faces": []})
            first = surface.refs[0]
            for offset in range(1, len(surface.refs) - 1):
                triangle = (first, surface.refs[offset], surface.refs[offset + 1])
                face = []
                for vertex_index, u, v in triangle:
                    face.append(len(bucket["vertices"]))
                    bucket["vertices"].append(transformed[vertex_index])
                    bucket["uv"].append((u, 1.0 - v))
                bucket["faces"].append(face)

    scene = trimesh.Scene(base_frame="Aircraft")
    for index, ((group, material_index, texture_name), data) in enumerate(buckets.items()):
        material_data = materials[material_index]
        alpha = max(0.0, min(1.0, 1.0 - material_data.transparency))
        image = None
        if texture_name and (texture_dir / texture_name).exists():
            image = Image.open(texture_dir / texture_name).copy()
        material = trimesh.visual.material.PBRMaterial(
            name=material_data.name,
            baseColorFactor=[
                int(channel * 255) for channel in material_data.color
            ] + [int(alpha * 255)],
            baseColorTexture=image,
            metallicFactor=0.0,
            roughnessFactor=0.72,
            alphaMode="BLEND" if alpha < 0.99 else "OPAQUE",
            doubleSided=alpha < 0.99,
        )
        visual = trimesh.visual.texture.TextureVisuals(
            uv=np.asarray(data["uv"], dtype=np.float32),
            material=material,
        )
        vertices = np.asarray(data["vertices"], dtype=np.float32)
        transform = np.eye(4)
        if group == "propeller":
            pivot = vertices.mean(axis=0)
            vertices -= pivot
            transform[:3, 3] = pivot
        mesh = trimesh.Trimesh(
            vertices=vertices,
            faces=np.asarray(data["faces"], dtype=np.int32),
            visual=visual,
            process=False,
        )
        mesh.remove_unreferenced_vertices()
        node_name = f"{'Propeller' if group == 'propeller' else 'Aircraft'}_{index:02d}"
        scene.add_geometry(mesh, node_name=node_name, geom_name=node_name, transform=transform)
    return scene


def main() -> None:
    argument_parser = argparse.ArgumentParser()
    argument_parser.add_argument("source", type=Path, help="Checkout de c172p-team/c172p")
    argument_parser.add_argument("output", type=Path, help="Directorio assets/models/c172p")
    args = argument_parser.parse_args()

    source_models = args.source / "Models"
    source_ac = source_models / "c172-common.ac"
    if not source_ac.exists() or not (args.source / "LICENSE").exists():
        raise SystemExit("El checkout no contiene Models/c172-common.ac y LICENSE")

    args.output.mkdir(parents=True, exist_ok=True)
    source_output = args.output / "source"
    source_output.mkdir(exist_ok=True)
    parser = AC3DParser(source_ac)
    root = parser.parse()
    write_filtered_source(parser, root, source_output / "c172p-exterior.ac")

    for texture in TEXTURES:
        optimize_texture(source_models / texture, source_output / texture)
    shutil.copy2(args.source / "LICENSE", args.output / "LICENSE-GPL-2.0.txt")
    shutil.copy2(args.source / "Thanks", args.output / "UPSTREAM-AUTHORS.txt")

    filtered_parser = AC3DParser(source_output / "c172p-exterior.ac")
    filtered_root = filtered_parser.parse()
    scene = build_scene(filtered_root, filtered_parser.materials, source_output)
    glb = trimesh.exchange.gltf.export_glb(scene, include_normals=True)
    (args.output / "aircraft.glb").write_bytes(glb)

    bounds = scene.bounds
    print(f"GLB: {args.output / 'aircraft.glb'} ({len(glb) / 1024 / 1024:.2f} MiB)")
    print(f"Dimensiones: {np.round(bounds[1] - bounds[0], 3)} m")
    print(f"Geometrías: {len(scene.geometry)}")


if __name__ == "__main__":
    main()
