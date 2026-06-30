#!/usr/bin/env python
"""Deploy pm-assistant-generic to TMD Hosting via FTP + cPanel API."""

import os
import ftplib
import urllib.request
import urllib.parse
import json
import base64

HOST = '69.72.136.201'
USER = 'kaizenmo'
PASS = '!Register001'
CPANEL_HOST = 's15102.usc1.stableserver.net'

LOCAL_SERVER = r'C:\Users\gerog\Documents\pm-assistant-generic\dist\server'
LOCAL_CLIENT = r'C:\Users\gerog\Documents\pm-assistant-generic\src\client\dist'

DEPLOYMENTS = [
    {
        'name': 'pm.kpbc.ca',
        'remote_server': '/home/kaizenmo/pm.ca/dist/server',
        'remote_client_staging': '/home/kaizenmo/pm.ca/src/client/dist',
        'remote_client_dest': '/home/kaizenmo/pm.ca',
        'deploy_client': True,
        'app_root': 'pm.ca',
        'domain': 'pm.kpbc.ca',
    },
    {
        'name': 'kovarti.com',
        'remote_server': '/home/kaizenmo/kovarti/dist/server',
        'remote_client_staging': None,
        'remote_client_dest': None,
        'deploy_client': False,
        'app_root': 'kovarti',
        'domain': 'kovarti.com',
    },
]


def ftp_makedirs(ftp, remote_dir):
    """Create remote directory and all parents."""
    parts = remote_dir.strip('/').split('/')
    path = ''
    for part in parts:
        path += '/' + part
        try:
            ftp.mkd(path)
        except ftplib.error_perm:
            pass  # already exists


def ftp_upload_dir(ftp, local_dir, remote_dir):
    """Recursively upload local_dir to remote_dir via FTP."""
    ftp_makedirs(ftp, remote_dir)

    for item in os.listdir(local_dir):
        local_path = os.path.join(local_dir, item)
        remote_path = remote_dir + '/' + item
        if os.path.isdir(local_path):
            ftp_upload_dir(ftp, local_path, remote_path)
        else:
            print(f'  uploading {remote_path}')
            with open(local_path, 'rb') as f:
                ftp.storbinary(f'STOR {remote_path}', f)


def cpanel_api(action, params=None):
    """Call cPanel UAPI."""
    creds = base64.b64encode(f'{USER}:{PASS}'.encode()).decode()
    url = f'https://{CPANEL_HOST}:2083/execute/{action}'
    if params:
        url += '?' + urllib.parse.urlencode(params)

    req = urllib.request.Request(url, headers={'Authorization': f'Basic {creds}'})
    # Disable SSL verification (shared hosting cert may not match)
    import ssl
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    try:
        with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
            data = json.loads(resp.read())
            return data
    except Exception as e:
        return {'error': str(e)}


def main():
    print(f'Connecting via FTP to {HOST}...')
    ftp = ftplib.FTP()
    ftp.connect(HOST, 21, timeout=30)
    ftp.login(USER, PASS)
    ftp.set_pasv(True)
    print(f'FTP connected. Root: {ftp.pwd()}\n')

    for dep in DEPLOYMENTS:
        print(f'=== Deploying to {dep["name"]} ===')

        print('Uploading server files...')
        ftp_upload_dir(ftp, LOCAL_SERVER, dep['remote_server'])
        print('Server files uploaded.')

        if dep['deploy_client']:
            print('Uploading client files...')
            ftp_upload_dir(ftp, LOCAL_CLIENT, dep['remote_client_staging'])
            print('Client files uploaded.')

            # Copy staged client files to web root via cPanel API
            print('Copying client to web root via cPanel API...')
            result = cpanel_api('Fileman/autocompletion_directory_list', {
                'dir': dep['remote_client_dest']
            })
            # Use cPanel file copy API
            src = dep['remote_client_staging']
            dst = dep['remote_client_dest']
            result = cpanel_api('Fileman/copy', {
                'path': src,
                'dest': dst,
                'overwrite': 1,
            })
            print(f'  Copy result: {result.get("status", result)}')

        # Restart via cPanel NodeJS API
        print(f'Restarting {dep["name"]} via cPanel API...')
        result = cpanel_api('NodeJS/restart_app', {'app_root': dep['app_root']})
        print(f'  Restart result: {result}')
        print(f'{dep["name"]} done.\n')

    ftp.quit()
    print('All deployments complete.')


if __name__ == '__main__':
    main()
