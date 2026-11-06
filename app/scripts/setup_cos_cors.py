"""配置 COS 桶的跨域规则, 前端直传前需执行一次。

用法: python -m app.scripts.setup_cos_cors http://localhost:5173 https://your.domain
"""

import sys

from qcloud_cos import CosConfig, CosS3Client

from app.shared.config import get_settings


def main(origins: list[str]) -> None:
    settings = get_settings().cos
    client = CosS3Client(
        CosConfig(
            Region=settings.region,
            SecretId=settings.secret_id,
            SecretKey=settings.secret_key,
            Scheme="https",
        )
    )
    client.put_bucket_cors(
        Bucket=settings.bucket,
        CORSConfiguration={
            "CORSRule": [
                {
                    "AllowedOrigin": origins,
                    "AllowedMethod": ["PUT", "GET", "HEAD"],
                    "AllowedHeader": ["*"],
                    "ExposeHeader": ["ETag"],
                    "MaxAgeSeconds": 600,
                }
            ]
        },
    )
    print(f"cors updated: bucket={settings.bucket} origins={origins}")


if __name__ == "__main__":
    main(sys.argv[1:] or ["http://localhost:5173"])
