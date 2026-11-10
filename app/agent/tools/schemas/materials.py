from pydantic import BaseModel, Field


class MaterialsLsInput(BaseModel):
    path: str = Field(
        default="/",
        description=(
            "资料库内的虚拟路径, 以 `/` 开头, 根目录为 `/`; "
            "例如 `/computer-networks-8e/05-运输层`。省略时等价于根目录。"
        ),
    )


class MaterialsReadInput(BaseModel):
    path: str = Field(
        description=(
            "要读取的文件虚拟路径, 以 `/` 开头, 必须是具体文件而不是目录; "
            "例如 `/computer-networks-8e/05-运输层/5.8.2-TCP的拥塞控制方法.md`。"
        ),
    )
    offset: int = Field(
        default=1,
        ge=1,
        description=(
            "起始行号, 从 1 开始, 默认 1; 接着上次没读完的内容继续时, 取上次最后一行行号 + 1。"
        ),
    )
    limit: int = Field(
        default=300,
        ge=1,
        le=500,
        description=(
            "本次最多返回的行数, 取值 1-500, 默认 300; "
            "返回行数正好等于 limit 时可能还有后续, 用更大的 offset 继续读。"
        ),
    )
    include_images: bool = Field(
        default=True,
        description=(
            "是否同时返回本段正文引用的图片, 默认 true; 纯文字阅读可设为 false 节省上下文。"
        ),
    )
    max_images: int = Field(
        default=6,
        ge=0,
        le=20,
        description="本次最多返回的图片数量, 取值 0-20, 默认 6。",
    )


class MaterialsGrepInput(BaseModel):
    query: str = Field(
        min_length=1,
        max_length=100,
        description=(
            "要搜索的字面量子串, 1-100 个字符, 不区分大小写; "
            "不支持正则和布尔语法, 只写一个关键词, 越精确命中越少越好读。"
        ),
    )
    path: str = Field(
        default="/",
        description=(
            "搜索范围, 以 `/` 开头, 可以是目录或单个文件, 默认 `/` 表示整个资料库; "
            "范围太大时命中容易被截断, 建议先缩小到章节目录。"
        ),
    )
    limit: int = Field(
        default=20,
        ge=1,
        le=100,
        description=(
            "最多返回的命中条数, 取值 1-100, 默认 20; "
            "命中数达到上限说明结果被截断, 应缩小 path 或换更精确的关键词。"
        ),
    )
