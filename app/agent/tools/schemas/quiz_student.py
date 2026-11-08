from pydantic import BaseModel, Field

from app.shared.enums import QuestionType


class QuizStudentQuestion(BaseModel):
    """一道检查题。单选题填 options 和 correct_option, 简答题填 reference_answer。"""

    question_type: QuestionType = Field(
        description=(
            "题型: `single_choice` 为单选, 必须给 options 和 correct_option; "
            "`short_answer` 为简答, 必须给 reference_answer。"
        ),
    )
    stem: str = Field(
        description=(
            "完整题干, 可以用 Markdown; 学生只看这张卡片, 所以题干要自包含, "
            "不要用「上题」「刚才」指代对话前文, 也不要把选项字母和内容写进题干。"
        ),
    )
    options: list[str] | None = Field(
        default=None,
        max_length=6,
        description=(
            "仅单选题: 2-6 个选项的文字列表, 按顺序自动对应 A/B/C/D/E/F; "
            "每项只写选项内容, 不要带 `A.` `B.` 之类的前缀。简答题传 null。"
        ),
    )
    correct_option: str | None = Field(
        default=None,
        description=(
            "仅单选题: 正确选项的字母, 取 `A`-`F` 中的一个大写字母, "
            "必须与 options 中的位置对应。简答题传 null。"
        ),
    )
    reference_answer: str | None = Field(
        default=None,
        description=(
            "仅简答题: 标准答案或得分要点, 用于判分和讲解, 不会展示给学生。单选题传 null。"
        ),
    )


class QuizStudentAnswer(BaseModel):
    answer: str = Field(
        description="学生提交的答案; 单选为选项字母, 简答为作答文本。",
    )
    question: QuizStudentQuestion = Field(
        description="被作答的原题, 用于回写题库。",
    )
