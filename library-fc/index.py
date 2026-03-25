# -*- coding: utf-8 -*-
import json
import os
import urllib.request
import urllib.error
import logging

from alibabacloud_fc20230330.client import Client as FC20230330Client
from alibabacloud_tea_openapi import models as open_api_models
from alibabacloud_fc20230330 import models as fc20230330_models
from alibabacloud_tea_util import models as util_models

logger = logging.getLogger()

FUNCTION_NAME = 'library-reservation-trigger'
TRIGGER_NAMES = ['timer', 'timer2']
GITHUB_REPO   = 'Lysssyo/library-reservation'
GITHUB_VAR    = 'LIB_SEAT_ID'

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
}


def make_response(status_code: int, body: dict) -> dict:
    return {
        'statusCode': status_code,
        'headers': CORS_HEADERS,
        'body': json.dumps(body),
    }


def create_fc_client() -> FC20230330Client:
    config = open_api_models.Config(
        access_key_id=os.environ.get('ALIBABA_CLOUD_ACCESS_KEY_ID'),
        access_key_secret=os.environ.get('ALIBABA_CLOUD_ACCESS_KEY_SECRET'),
    )
    config.endpoint = '1400907468986719.cn-hongkong.fc.aliyuncs.com'
    return FC20230330Client(config)


def github_request(method: str, path: str, body: dict = None):
    token = os.environ.get('GITHUB_PAT')
    url = f'https://api.github.com{path}'
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        'Authorization': f'Bearer {token}',
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
    })
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def handle_status():
    client = create_fc_client()
    runtime = util_models.RuntimeOptions()
    resp = client.get_trigger_with_options(FUNCTION_NAME, TRIGGER_NAMES[0], {}, runtime)
    config = json.loads(resp.body.trigger_config)
    trigger_enabled = config.get('enable', True)

    status_code, body = github_request('GET', f'/repos/{GITHUB_REPO}/actions/variables/{GITHUB_VAR}')
    seat_id = json.loads(body).get('value', '') if status_code == 200 else ''

    return {'triggerEnabled': trigger_enabled, 'seatId': seat_id}


def handle_toggle(enable: bool):
    client = create_fc_client()
    runtime = util_models.RuntimeOptions()
    for trigger_name in TRIGGER_NAMES:
        update_input = fc20230330_models.UpdateTriggerInput(
            trigger_config=json.dumps({'enable': enable})
        )
        request = fc20230330_models.UpdateTriggerRequest(body=update_input)
        client.update_trigger_with_options(FUNCTION_NAME, trigger_name, request, {}, runtime)
    return {'success': True}


def handle_set_seat(seat: str):
    status_code, body = github_request(
        'PATCH',
        f'/repos/{GITHUB_REPO}/actions/variables/{GITHUB_VAR}',
        {'name': GITHUB_VAR, 'value': seat}
    )
    if status_code == 204:
        return {'success': True}
    return {'success': False, 'error': json.loads(body).get('message', 'unknown error')}


def handler(event, context):
    event_data = json.loads(event.decode('utf-8'))
    method = event_data.get('requestContext', {}).get('http', {}).get('method', '')

    # CORS preflight
    if method == 'OPTIONS':
        return make_response(200, {})

    try:
        body = json.loads(event_data.get('body', '{}'))
        action = body.get('action')

        if action == 'status':
            result = handle_status()
        elif action == 'toggle':
            result = handle_toggle(bool(body.get('enable', False)))
        elif action == 'set-seat':
            result = handle_set_seat(str(body.get('seat', '')))
        else:
            result = {'error': f'unknown action: {action}'}

        return make_response(200, result)

    except Exception as e:
        logger.error(f"handler error: {e}")
        return make_response(500, {'error': str(e)})
