---
date created: 2026-03-17 13:51:44
date modified: 2026-03-18 00:22:36
---
```python
# -*- coding: utf-8 -*-

# This file is auto-generated, don't edit it. Thanks.

import os

import sys

import json

  

from typing import List

  

from alibabacloud_fc20230330.client import Client as FC20230330Client

from alibabacloud_credentials.client import Client as CredentialClient

from alibabacloud_tea_openapi import models as open_api_models

from alibabacloud_fc20230330 import models as fc20230330_models

from alibabacloud_tea_util import models as util_models

from alibabacloud_tea_util.client import Client as UtilClient

  
  

class Sample:

    def __init__(self):

        pass

  

    @staticmethod

    def create_client() -> FC20230330Client:

        """

        使用凭据初始化账号Client

        @return: Client

        @throws Exception

        """

        # 工程代码建议使用更安全的无AK方式，凭据配置方式请参见：https://help.aliyun.com/document_detail/378659.html。

        credential = CredentialClient()

        config = open_api_models.Config(

            credential=credential

        )

        # Endpoint 请参考 https://api.aliyun.com/product/FC

        config.endpoint = f'1400907468986719.cn-hongkong.fc.aliyuncs.com'

        return FC20230330Client(config)

  

    @staticmethod

    def main(

        args: List[str],

    ) -> None:

        client = Sample.create_client()

        update_trigger_input = fc20230330_models.UpdateTriggerInput(

            trigger_config='{"enable":false}'

        )

        update_trigger_request = fc20230330_models.UpdateTriggerRequest(

            body=update_trigger_input

        )

        runtime = util_models.RuntimeOptions()

        headers = {}

        try:

            resp = client.update_trigger_with_options('library-reservation-trigger', 'timer2', update_trigger_request, headers, runtime)

            print(json.dumps(resp, default=str, indent=2))

        except Exception as error:

            # 此处仅做打印展示，请谨慎对待异常处理，在工程项目中切勿直接忽略异常。

            # 错误 message

            print(error.message)

            # 诊断地址

            print(error.data.get("Recommend"))

  

    @staticmethod

    async def main_async(

        args: List[str],

    ) -> None:

        client = Sample.create_client()

        update_trigger_input = fc20230330_models.UpdateTriggerInput(

            trigger_config='{"enable":false}'

        )

        update_trigger_request = fc20230330_models.UpdateTriggerRequest(

            body=update_trigger_input

        )

        runtime = util_models.RuntimeOptions()

        headers = {}

        try:

            resp = await client.update_trigger_with_options_async('library-reservation-trigger', 'timer2', update_trigger_request, headers, runtime)

            print(json.dumps(resp, default=str, indent=2))

        except Exception as error:

            # 此处仅做打印展示，请谨慎对待异常处理，在工程项目中切勿直接忽略异常。

            # 错误 message

            print(error.message)

            # 诊断地址

            print(error.data.get("Recommend"))

  
  

if __name__ == '__main__':

    Sample.main(sys.argv[1:])
```


```python
# -*- coding: utf-8 -*-

import logging

import json

import requests

import os

import time  # 引入 time 模块用于等待

  

def handler(event, context):

    logger = logging.getLogger()

    # --- 配置区域 ---

    MAX_RETRIES = 3      # 最大重试次数

    RETRY_DELAY = 2      # 每次重试等待秒数

    # 环境变量

    owner = os.environ.get('GH_OWNER')

    repo = os.environ.get('GH_REPO')

    token = os.environ.get('GH_PAT')

    # 基础检查

    if not all([owner, repo, token]):

        logger.error("环境变量缺失，请检查 GH_OWNER, GH_REPO, GH_PAT")

        return "Config Error"

  

    url = f"https://api.github.com/repos/{owner}/{repo}/dispatches"

    headers = {

        "Accept": "application/vnd.github.v3+json",

        "Authorization": f"token {token}",

        "User-Agent": "Aliyun-FC-Timer"

    }

    payload = {

        "event_type": "fc-timer-trigger",

        "client_payload": {

            "from": "aliyun-fc-timer"

        }

    }

  

    # --- 重试逻辑 ---

    for attempt in range(1, MAX_RETRIES + 1):

        try:

            logger.info(f"开始第 {attempt} 次尝试触发 GitHub Action...")

            resp = requests.post(url, json=payload, headers=headers, timeout=10) # 建议加上 timeout 防止卡死

            # GitHub Action 触发成功通常返回 204 No Content

            if resp.status_code == 204:

                logger.info(f"✅ 成功触发 GitHub Action！(尝试次数: {attempt})")

                return "Trigger Success"

            else:

                logger.warning(f"⚠️ 第 {attempt} 次请求失败，状态码: {resp.status_code}, 响应: {resp.text}")

        except requests.exceptions.RequestException as e:

            # 捕获网络连接错误、超时等

            logger.warning(f"⚠️ 第 {attempt} 次请求发生异常: {e}")

  

        # 如果不是最后一次尝试，则等待后重试

        if attempt < MAX_RETRIES:

            logger.info(f"等待 {RETRY_DELAY} 秒后重试...")

            time.sleep(RETRY_DELAY)

        else:

            logger.error("❌ 已达到最大重试次数，触发失败。")

            # 这里可以选择 raise 抛出异常让 FC 记录为调用失败，或者 return 错误信息

            return f"Failed after {MAX_RETRIES} attempts"
```



121：101267824
122：101267825
126：101267829
094：101267797