import urllib.request
import urllib.parse
import json
import sys

BASE_URL = 'https://studybuddy-poweredby-ai.onrender.com'

# Login User A
login_data = json.dumps({'email': 'demo@studybuddy.test', 'password': 'Password123!'}).encode('utf-8')
req = urllib.request.Request(f'{BASE_URL}/api/auth/login', data=login_data, headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req) as resp:
    token_a = json.loads(resp.read().decode('utf-8'))['access_token']

print('Logged in User A.')
SESSION_ID = 21

print('\n' + '='*60)
print('T5a: Optimistic concurrency / Stale client update prevention')
print('='*60)

# 1. GET current artifact revision R
req = urllib.request.Request(
    f'{BASE_URL}/api/sessions/{SESSION_ID}/artifacts/flashcards',
    headers={'Authorization': f'Bearer {token_a}'}
)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode('utf-8'))
    curr_rev = data['revision']
    print(f'1. Initial GET -> server revision R = {curr_rev}')

# 2. PUT revision=R, payload A -> 200 {revision: R+1}
payload_a = {'deckId': 100, 'cards': [{'id': 'c1', 'front': 'Payload A', 'back': 'First update'}]}
put_req = urllib.request.Request(
    f'{BASE_URL}/api/sessions/{SESSION_ID}/artifacts/flashcards',
    data=json.dumps({'schema_version': 1, 'revision': curr_rev, 'payload': payload_a}).encode('utf-8'),
    headers={'Authorization': f'Bearer {token_a}', 'Content-Type': 'application/json'},
    method='PUT'
)
with urllib.request.urlopen(put_req) as resp:
    res = json.loads(resp.read().decode('utf-8'))
    new_rev = res['revision']
    print(f'2. PUT with revision={curr_rev} -> 200 OK, new server revision = {new_rev}')

# 3. Repeat PUT with stale revision=curr_rev (already incremented) and payload B -> Expect 409
payload_b = {'deckId': 100, 'cards': [{'id': 'c1', 'front': 'Payload B', 'back': 'Stale update'}]}
stale_req = urllib.request.Request(
    f'{BASE_URL}/api/sessions/{SESSION_ID}/artifacts/flashcards',
    data=json.dumps({'schema_version': 1, 'revision': curr_rev, 'payload': payload_b}).encode('utf-8'),
    headers={'Authorization': f'Bearer {token_a}', 'Content-Type': 'application/json'},
    method='PUT'
)
try:
    with urllib.request.urlopen(stale_req) as resp:
        print('3. Unexpected 200 for stale revision!')
except urllib.error.HTTPError as e:
    conflict_body = json.loads(e.read().decode('utf-8'))
    print(f'3. PUT with stale revision={curr_rev} -> {e.code} Conflict')
    print('   Server conflict body:', json.dumps(conflict_body))

# 4. GET to confirm payload is still A (lost update prevented)
req = urllib.request.Request(
    f'{BASE_URL}/api/sessions/{SESSION_ID}/artifacts/flashcards',
    headers={'Authorization': f'Bearer {token_a}'}
)
with urllib.request.urlopen(req) as resp:
    check_data = json.loads(resp.read().decode('utf-8'))
    print('4. Post-409 GET server payload:', json.dumps(check_data['payload']))
    print(f'   Is payload still Payload A? {"YES - LOST UPDATE PREVENTED" if check_data["payload"] == payload_a else "NO - CORRUPTED"}')

print('\n' + '='*60)
print('T5b: Future revision check (server + 100)')
print('='*60)
future_req = urllib.request.Request(
    f'{BASE_URL}/api/sessions/{SESSION_ID}/artifacts/flashcards',
    data=json.dumps({'schema_version': 1, 'revision': new_rev + 100, 'payload': {'future': True}}).encode('utf-8'),
    headers={'Authorization': f'Bearer {token_a}', 'Content-Type': 'application/json'},
    method='PUT'
)
try:
    with urllib.request.urlopen(future_req) as resp:
        print('Unexpected 200 for future revision!')
except urllib.error.HTTPError as e:
    print(f'PUT with future revision={new_rev+100} -> {e.code} Conflict')
    print('Server body:', e.read().decode('utf-8'))

print('\n' + '='*60)
print('T5c: Concurrent PUT simulation')
print('='*60)
import concurrent.futures

def send_put(label, rev):
    try:
        body = json.dumps({'schema_version': 1, 'revision': rev, 'payload': {'worker': label}}).encode('utf-8')
        r = urllib.request.Request(
            f'{BASE_URL}/api/sessions/{SESSION_ID}/artifacts/flashcards',
            data=body,
            headers={'Authorization': f'Bearer {token_a}', 'Content-Type': 'application/json'},
            method='PUT'
        )
        with urllib.request.urlopen(r) as res:
            return (label, res.status, res.read().decode('utf-8'))
    except urllib.error.HTTPError as err:
        return (label, err.code, err.read().decode('utf-8'))

# Server is currently at new_rev
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
    fut1 = executor.submit(send_put, 'Worker-1', new_rev)
    fut2 = executor.submit(send_put, 'Worker-2', new_rev)
    res1 = fut1.result()
    res2 = fut2.result()

print(f'Worker 1: Status {res1[1]}')
print(f'Worker 2: Status {res2[1]}')
statuses = [res1[1], res2[1]]
print(f'Concurrent race result: 200 won by {"Worker-1" if res1[1]==200 else "Worker-2"}, other returned 409: {200 in statuses and 409 in statuses}')

print('\n' + '='*60)
print('T5d: PUT missing revision field')
print('='*60)
no_rev_req = urllib.request.Request(
    f'{BASE_URL}/api/sessions/{SESSION_ID}/artifacts/flashcards',
    data=json.dumps({'schema_version': 1, 'payload': {'missing_rev': True}}).encode('utf-8'),
    headers={'Authorization': f'Bearer {token_a}', 'Content-Type': 'application/json'},
    method='PUT'
)
try:
    with urllib.request.urlopen(no_rev_req) as resp:
        print('Status:', resp.status)
except urllib.error.HTTPError as e:
    print(f'Status: {e.code} Unprocessable Entity / Bad Request (Validation enforced)')
    print('Server body:', e.read().decode('utf-8'))
