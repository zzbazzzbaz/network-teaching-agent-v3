"""教学对话领域的共享常量。

只放跨文件、跨进程必须保持一致的领域常量。
部署配置放 config.py, 密钥和 URL 不要放这里。
"""

SYSTEM_USER_ID = "system"
TEACH_AGENT_ID = "teach_agent"
CHAT_CREDENTIAL_ID = "deepseek"
EMBEDDING_CREDENTIAL_ID = "bailian"
EMBEDDING_CREDENTIAL_TYPE = "dashscope_credential"
EMBEDDING_DIMENSIONS = 1024
SESSION_PLACEHOLDER_TITLE = "新对话"

MAX_PRIVATE_KNOWLEDGE_BASES = 10
MAX_KNOWLEDGE_DOCUMENTS = 50
MAX_SESSION_KNOWLEDGE_BASES = 20

KNOWLEDGE_ALLOWED_EXTENSIONS = (".pdf", ".docx", ".pptx", ".md", ".txt", ".html")
APP_TIMEZONE = "Asia/Shanghai"
USER_ID_HEADER = "X-User-ID"
