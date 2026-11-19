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

# Login User B
login_b = json.dumps({'email': 'user_b_test@studybuddy.test', 'password': 'Password123!'}).encode('utf-8')
req = urllib.request.Request(f'{BASE_URL}/api/auth/login', data=login_b, headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req) as resp:
    token_b = json.loads(resp.read().decode('utf-8'))['access_token']

print('Logged in User A and User B.')

SESSION_ID = 21

# Setup: User A sets a flashcard artifact on SESSION_ID (fetch current revision first)
req = urllib.request.Request(
    f'{BASE_URL}/api/sessions/{SESSION_ID}/artifacts/flashcards',
    headers={'Authorization': f'Bearer {token_a}'}
)
try:
    with urllib.request.urlopen(req) as resp:
        cur_data = json.loads(resp.read().decode('utf-8'))
        next_rev = cur_data['revision']
except Exception:
    next_rev = 1

init_payload = {
    'schema_version': 1,
    'revision': next_rev,
    'payload': {'deckId': 99, 'cards': [{'id': 'c1', 'front': 'Cell', 'back': 'Unit of life'}]}
}
req = urllib.request.Request(
    f'{BASE_URL}/api/sessions/{SESSION_ID}/artifacts/flashcards',
    data=json.dumps(init_payload).encode('utf-8'),
    headers={'Authorization': f'Bearer {token_a}', 'Content-Type': 'application/json'},
    method='PUT'
)
with urllib.request.urlopen(req) as resp:
    print('Setup PUT by User A Status:', resp.status, resp.read().decode('utf-8'))

# Confirm User A GET
req = urllib.request.Request(
    f'{BASE_URL}/api/sessions/{SESSION_ID}/artifacts/flashcards',
    headers={'Authorization': f'Bearer {token_a}'}
)
with urllib.request.urlopen(req) as resp:
    print('Confirm GET by User A Status:', resp.status, resp.read().decode('utf-8'))

print('\n' + '='*50)
print('T4a: User B GET User A session artifact')
print('='*50)
try:
    req = urllib.request.Request(
        f'{BASE_URL}/api/sessions/{SESSION_ID}/artifacts/flashcards',
        headers={'Authorization': f'Bearer {token_b}'}
    )
    with urllib.request.urlopen(req) as resp:
        print('Status:', resp.status, resp.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print('Status:', e.code, e.read().decode('utf-8'))

print('\n' + '='*50)
print('T4b: User B PUT User A session artifact')
print('='*50)
try:
    put_body = json.dumps({'schema_version': 1, 'revision': 1, 'payload': {'hacked': True}}).encode('utf-8')
    req = urllib.request.Request(
        f'{BASE_URL}/api/sessions/{SESSION_ID}/artifacts/flashcards',
        data=put_body,
        headers={'Authorization': f'Bearer {token_b}', 'Content-Type': 'application/json'},
        method='PUT'
    )
    with urllib.request.urlopen(req) as resp:
        print('Status:', resp.status, resp.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print('Status:', e.code, e.read().decode('utf-8'))

print('\n' + '='*50)
print('T4c: User B DELETE User A session artifact')
print('='*50)
try:
    req = urllib.request.Request(
        f'{BASE_URL}/api/sessions/{SESSION_ID}/artifacts/flashcards',
        headers={'Authorization': f'Bearer {token_b}'},
        method='DELETE'
    )
    with urllib.request.urlopen(req) as resp:
        print('Status:', resp.status, resp.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print('Status:', e.code, e.read().decode('utf-8'))

print('\n' + '='*50)
print('T4d: User B GET sessions list')
print('='*50)
req = urllib.request.Request(
    f'{BASE_URL}/api/conversations',
    headers={'Authorization': f'Bearer {token_b}'}
)
with urllib.request.urlopen(req) as resp:
    b_convs = json.loads(resp.read().decode('utf-8'))
    print(f'Status: {resp.status}')
    print(f'User B session count: {len(b_convs)}')
    print('User B session IDs:', [c['id'] for c in b_convs])
    print(f'Does User B list contain User A Session {SESSION_ID}? {"YES - LEAK!" if any(c["id"] == SESSION_ID for c in b_convs) else "NO - ISOLATED"}')

print('\n' + '='*50)
print('T4e: Unauthenticated GET (no token)')
print('='*50)
try:
    req = urllib.request.Request(f'{BASE_URL}/api/sessions/{SESSION_ID}/artifacts/flashcards')
    with urllib.request.urlopen(req) as resp:
        print('Status:', resp.status, resp.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print('Status:', e.code, e.read().decode('utf-8'))

print('\n' + '='*50)
print('T4f: User B GET User A session chat messages')
print('='*50)
try:
    req = urllib.request.Request(
        f'{BASE_URL}/api/chat?conversation_id={SESSION_ID}',
        headers={'Authorization': f'Bearer {token_b}'}
    )
    with urllib.request.urlopen(req) as resp:
        msgs = json.loads(resp.read().decode('utf-8'))
        print('Status:', resp.status, f'Messages count: {len(msgs)}')
        if len(msgs) == 0:
            print('Isolated: User B sees 0 messages for User A session ID.')
except urllib.error.HTTPError as e:
    print('Status:', e.code, e.read().decode('utf-8'))
