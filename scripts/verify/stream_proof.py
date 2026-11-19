import urllib.request
import urllib.parse
import json
import time
import sys

BASE_URL = 'https://studybuddy-poweredby-ai.onrender.com'

# Login User A
login_data = json.dumps({'email': 'demo@studybuddy.test', 'password': 'Password123!'}).encode('utf-8')
req = urllib.request.Request(f'{BASE_URL}/api/auth/login', data=login_data, headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req) as resp:
    token_a = json.loads(resp.read().decode('utf-8'))['access_token']

print('Logged in User A successfully.')

# Stream chat requesting knowledge
chat_payload = json.dumps({
    'message': 'Explain cellular respiration and how ATP is generated in mitochondria in detail step by step.'
}).encode('utf-8')

stream_req = urllib.request.Request(
    f'{BASE_URL}/api/chat/stream',
    data=chat_payload,
    headers={
        'Authorization': f'Bearer {token_a}',
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
    }
)

start_time = time.monotonic()
first_token_time = None
last_token_time = None
event_count = 0
token_count = 0
token_offsets = []
gaps = []
all_headers = []

print('--- STREAM REQUEST INITIATED ---')
with urllib.request.urlopen(stream_req) as resp:
    all_headers = resp.getheaders()
    prev_time = time.monotonic()
    
    for line in resp:
        curr_time = time.monotonic()
        decoded = line.decode('utf-8', errors='replace').rstrip('\r\n')
        offset = curr_time - start_time
        
        if not decoded:
            continue
            
        event_count += 1
        print(f'[{offset:06.3f}s] {decoded}')
        
        if decoded.startswith('data:'):
            data_str = decoded[5:].strip()
            if data_str == '[DONE]':
                continue
            try:
                parsed = json.loads(data_str)
                if 'token' in parsed or 'chunk' in parsed:
                    tok = parsed.get('token') or parsed.get('chunk')
                    token_count += 1
                    token_offsets.append(offset)
                    if first_token_time is None:
                        first_token_time = curr_time
                    gap = curr_time - prev_time
                    gaps.append(gap)
                    last_token_time = curr_time
                    prev_time = curr_time
            except Exception:
                pass

print('--- STREAM COMPLETE ---')

print('\n' + '='*60)
print('ALL DEPLOYED RESPONSE HEADERS:')
print('='*60)
for k, v in all_headers:
    print(f'{k}: {v}')

print('\n' + '='*60)
print('STREAM METRICS REPORT:')
print('='*60)
ttft_ms = ((first_token_time - start_time) * 1000) if first_token_time else 0
total_stream_span_ms = ((last_token_time - first_token_time) * 1000) if (first_token_time and last_token_time) else 0

print(f'Total SSE events: {event_count}')
print(f'Total token chunks: {token_count}')
print(f'TTFT (Time To First Token): {ttft_ms:.1f}ms')
print(f'Token stream duration: {total_stream_span_ms:.1f}ms')

if gaps:
    sorted_gaps = sorted(gaps)
    median_gap = sorted_gaps[len(sorted_gaps)//2]
    print(f'Min inter-token gap: {min(gaps)*1000:.1f}ms')
    print(f'Median inter-token gap: {median_gap*1000:.1f}ms')
    print(f'Max inter-token gap: {max(gaps)*1000:.1f}ms')

distinct_timestamps = len(set(f'{x:.2f}' for x in token_offsets))
print(f'Distinct timestamps (rounded to 10ms): {distinct_timestamps}')

print('\nVERIFICATION PASS CRITERIA:')
cond_a = token_count >= 10
cond_b = total_stream_span_ms > 1000
cond_c = distinct_timestamps > 3

print(f'  a) >= 10 token events: {cond_a} ({token_count})')
print(f'  b) stream span > 1000ms: {cond_b} ({total_stream_span_ms:.1f}ms)')
print(f'  c) > 3 distinct timestamps: {cond_c} ({distinct_timestamps})')

if cond_a and cond_b and cond_c:
    print('STREAM PROOF STATUS: PASS')
else:
    print('STREAM PROOF STATUS: FAIL')
