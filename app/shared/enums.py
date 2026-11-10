from enum import StrEnum


class UserStatus(StrEnum):
    ACTIVE = "active"
    DISABLED = "disabled"


class UserRole(StrEnum):
    STUDENT = "student"
    ADMIN = "admin"


class AgentKind(StrEnum):
    TEACH = "teach_agent"
    EXP = "exp_agent"
    EXAM = "exam_agent"


class QuestionType(StrEnum):
    SINGLE_CHOICE = "single_choice"
    SHORT_ANSWER = "short_answer"


class FileStatus(StrEnum):
    PENDING = "pending"
    READY = "ready"


class MaterialCollectionKind(StrEnum):
    TEXTBOOK = "textbook"
    QUESTION_BANK = "question_bank"
