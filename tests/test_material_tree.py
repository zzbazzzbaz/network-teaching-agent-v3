import uuid

import pytest

from app.api.repositories.models import MaterialCollection, MaterialNode
from app.api.services import material_service
from app.shared.enums import MaterialCollectionKind


def _collection(
    *,
    slug: str = "computer-networks-8e",
    kind: MaterialCollectionKind = MaterialCollectionKind.TEXTBOOK,
) -> MaterialCollection:
    return MaterialCollection(
        slug=slug,
        title="计算机网络(第8版)",
        kind=kind,
    )


def _node(
    collection: MaterialCollection,
    name: str,
    *,
    content: str | None = None,
    parent_id: uuid.UUID | None = None,
    sort_order: int = 0,
) -> MaterialNode:
    return MaterialNode(
        collection_id=collection.id,
        parent_id=parent_id,
        name=name,
        content=content,
        sort_order=sort_order,
    )


def test_display_title_rules() -> None:
    assert (
        material_service.display_title(
            name="05-运输层",
            kind="folder",
            parent_name=None,
            is_collection_root=True,
            collection_kind=MaterialCollectionKind.TEXTBOOK,
        )
        == "第5章 运输层"
    )
    assert (
        material_service.display_title(
            name="5.8.2-TCP的拥塞控制方法",
            kind="document",
            parent_name="05-运输层",
            is_collection_root=False,
            collection_kind=MaterialCollectionKind.TEXTBOOK,
        )
        == "5.8.2 TCP的拥塞控制方法"
    )
    assert (
        material_service.display_title(
            name="00-toc",
            kind="document",
            parent_name=None,
            is_collection_root=True,
            collection_kind=MaterialCollectionKind.TEXTBOOK,
        )
        == "全书目录"
    )
    assert (
        material_service.display_title(
            name="index",
            kind="document",
            parent_name="figures",
            is_collection_root=False,
            collection_kind=MaterialCollectionKind.TEXTBOOK,
        )
        == "图注索引"
    )


def test_tree_paths_and_sorting() -> None:
    collection = _collection()
    chapter = _node(collection, "05-运输层", sort_order=1)
    section = _node(
        collection,
        "5.8.2-TCP的拥塞控制方法",
        content="# 内容",
        parent_id=chapter.id,
        sort_order=2,
    )
    first = _node(collection, "5.1-概述", content="# 概述", parent_id=chapter.id, sort_order=1)

    library = material_service._build_library([collection], [chapter, section, first])
    tree = material_service._tree(library)

    assert tree[0].children[0].title == "第5章 运输层"
    assert tree[0].children[0].path == "/computer-networks-8e/05-运输层"
    assert [item.title for item in tree[0].children[0].children] == [
        "5.1 概述",
        "5.8.2 TCP的拥塞控制方法",
    ]
    assert (
        tree[0].children[0].children[1].path
        == "/computer-networks-8e/05-运输层/5.8.2-TCP的拥塞控制方法.md"
    )


def test_rename_recomputes_path_without_recursive_update() -> None:
    collection = _collection()
    chapter = _node(collection, "05-运输层")
    section = _node(collection, "5.8.2-旧名称", content="# 内容", parent_id=chapter.id)

    before = material_service._build_library([collection], [chapter, section])
    assert before.views[section.id].path.endswith("/5.8.2-旧名称.md")

    section.name = "5.8.2-新名称"
    after = material_service._build_library([collection], [chapter, section])
    assert after.views[section.id].path.endswith("/5.8.2-新名称.md")


def test_non_markdown_document_keeps_its_suffix() -> None:
    collection = _collection(slug=".templates")
    template = _node(collection, "step-demo.html", content="<div>模板</div>")

    library = material_service._build_library([collection], [template])

    assert library.views[template.id].path == "/.templates/step-demo.html"
    view = material_service._find_by_path(library, "/.templates/step-demo.html")
    assert view.node.id == template.id


def test_collection_root_paths_resolve() -> None:
    collection = _collection()
    chapter = _node(collection, "05-运输层")
    library = material_service._build_library([collection], [chapter])

    assert material_service._collection_by_path(library, "/computer-networks-8e") is collection
    assert material_service._collection_by_path(library, "/computer-networks-8e/05-运输层") is None
    assert material_service._collection_by_path(library, "/missing") is None


def test_find_by_path_supports_document_without_suffix() -> None:
    collection = _collection()
    document = _node(collection, "00-toc", content="# 目录")
    library = material_service._build_library([collection], [document])

    view = material_service._find_by_path(library, "/computer-networks-8e/00-toc")
    assert view.node.id == document.id
    with pytest.raises(material_service.NodeNotFoundError):
        material_service._find_by_path(library, "/missing")


def test_is_descendant_rejects_cycles() -> None:
    collection = _collection()
    root = _node(collection, "章")
    child = _node(collection, "节", content="#", parent_id=root.id)
    library = material_service._build_library([collection], [root, child])

    assert material_service._is_descendant(
        library,
        node_id=root.id,
        candidate_id=child.id,
    )
    assert not material_service._is_descendant(
        library,
        node_id=child.id,
        candidate_id=root.id,
    )


def test_validated_name_rejects_paths() -> None:
    assert material_service._validated_name("5.8.2-TCP的拥塞控制方法", is_document=True) == (
        "5.8.2-TCP的拥塞控制方法"
    )
    assert material_service._validated_name("note.md", is_document=True) == "note"
    for name in ("", "..", "a/b", "a\\b"):
        with pytest.raises(material_service.InvalidNodeError):
            material_service._validated_name(name, is_document=False)
