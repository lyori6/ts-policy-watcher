Run python scripts/fetch.py
  python scripts/fetch.py
  shell: /usr/bin/bash -e {0}
  env:
    pythonLocation: /opt/hostedtoolcache/Python/3.11.13/x64
    PKG_CONFIG_PATH: /opt/hostedtoolcache/Python/3.11.13/x64/lib/pkgconfig
    Python_ROOT_DIR: /opt/hostedtoolcache/Python/3.11.13/x64
    Python2_ROOT_DIR: /opt/hostedtoolcache/Python/3.11.13/x64
    Python3_ROOT_DIR: /opt/hostedtoolcache/Python/3.11.13/x64
    LD_LIBRARY_PATH: /opt/hostedtoolcache/Python/3.11.13/x64/lib
    - Attempt 1/2 FAILED. Reason: Page.goto: net::ERR_NAME_NOT_RESOLVED at https://support.whatnot.com/hc/en-us/articles/360060824552-Community-Guidelines
Call log:
  - navigating to "https://support.whatnot.com/hc/en-us/articles/360060824552-Community-Guidelines", waiting until "domcontentloaded"

    - Attempt 2/2 FAILED. Reason: Page.goto: net::ERR_NAME_NOT_RESOLVED at https://support.whatnot.com/hc/en-us/articles/360060824552-Community-Guidelines
Call log:
  - navigating to "https://support.whatnot.com/hc/en-us/articles/360060824552-Community-Guidelines", waiting until "domcontentloaded"

    - Attempt 1/2 FAILED. Reason: Page.goto: net::ERR_NAME_NOT_RESOLVED at https://support.whatnot.com/hc/en-us/articles/360060825312-Prohibited-Items
Call log:
  - navigating to "https://support.whatnot.com/hc/en-us/articles/360060825312-Prohibited-Items", waiting until "domcontentloaded"

    - Attempt 2/2 FAILED. Reason: Page.goto: net::ERR_NAME_NOT_RESOLVED at https://support.whatnot.com/hc/en-us/articles/360060825312-Prohibited-Items
Call log:
  - navigating to "https://support.whatnot.com/hc/en-us/articles/360060825312-Prohibited-Items", waiting until "domcontentloaded"

    - Attempt 1/2 FAILED. Reason: Request URL is missing an 'http://' or 'https://' protocol.
    - Attempt 2/2 FAILED. Reason: Request URL is missing an 'http://' or 'https://' protocol.

--- Fetch completed with 3 failures. ---
--- Starting Fetcher Script ---
Successfully loaded 21 pages from config.

[INFO] Processing 'whatnot-community-guidelines'...
  - URL: https://support.whatnot.com/hc/en-us/articles/360060824552-Community-Guidelines
  - Renderer: playwright

[INFO] Processing 'whatnot-hate-and-harassment'...
  - URL: https://help.whatnot.com/hc/en-us/articles/29262074925069-Hate-and-Harassment-Policy
  - Renderer: playwright
  - SUCCESS: Snapshot saved to snapshots/whatnot-hate-and-harassment/2025-07-20T234900Z.html

[INFO] Processing 'whatnot-prohibited-items'...
  - URL: https://support.whatnot.com/hc/en-us/articles/360060825312-Prohibited-Items
  - Renderer: playwright

[INFO] Processing 'tiktok-community-guidelines'...
  - URL: https://www.tiktok.com/community-guidelines/en/
  - Renderer: playwright
  - SUCCESS: Snapshot saved to snapshots/tiktok-community-guidelines/2025-07-20T234910Z.html

[INFO] Processing 'tiktok-live-moderation'...
  - URL: https://support.tiktok.com/en/live-gifts-wallet/tiktok-live/moderating-on-tiktok-live
  - Renderer: playwright
  - SUCCESS: Snapshot saved to snapshots/tiktok-live-moderation/2025-07-20T234915Z.html

[INFO] Processing 'tiktok-shop-prohibited-products'...
  - URL: https://seller-us.tiktok.com/university/rule-detail/10003057
  - Renderer: playwright
  - SUCCESS: Snapshot saved to snapshots/tiktok-shop-prohibited-products/2025-07-20T234919Z.html

[INFO] Processing 'tiktok-blocking-users'...
  - URL: https://support.tiktok.com/en/using-tiktok/followers-and-following/blocking-the-users
  - Renderer: playwright
  - SUCCESS: Snapshot saved to snapshots/tiktok-blocking-users/2025-07-20T234923Z.html

[INFO] Processing 'instagram-community-guidelines'...
  - URL: https://help.instagram.com/477434105621119
  - Renderer: playwright
  - SUCCESS: Snapshot saved to snapshots/instagram-community-guidelines/2025-07-20T234927Z.html

[INFO] Processing 'instagram-appeal-process'...
  - URL: https://help.instagram.com/675885993348720
  - Renderer: playwright
  - SUCCESS: Snapshot saved to snapshots/instagram-appeal-process/2025-07-20T234932Z.html

[INFO] Processing 'instagram-commerce-policies'...
  - URL: https://help.instagram.com/1627591227523036
  - Renderer: playwright
  - SUCCESS: Snapshot saved to snapshots/instagram-commerce-policies/2025-07-20T234936Z.html

[INFO] Processing 'instagram-blocking-people'...
  - URL: https://help.instagram.com/426700567389543
  - Renderer: playwright
  - SUCCESS: Snapshot saved to snapshots/instagram-blocking-people/2025-07-20T234940Z.html

[INFO] Processing 'youtube-community-guidelines'...
  - URL: https://www.youtube.com/howyoutubeworks/policies/community-guidelines/
  - Renderer: httpx
  - SUCCESS: Snapshot saved to snapshots/youtube-community-guidelines/2025-07-20T234940Z.html

[INFO] Processing 'youtube-harassment-policy'...
  - URL: https://support.google.com/youtube/answer/2802268
  - Renderer: httpx
  - SUCCESS: Snapshot saved to snapshots/youtube-harassment-policy/2025-07-20T234941Z.html

[INFO] Processing 'youtube-shopping-ads-policy'...
  - URL: https://support.google.com/merchants/answer/6149970
  - Renderer: httpx
  - SUCCESS: Snapshot saved to snapshots/youtube-shopping-ads-policy/2025-07-20T234941Z.html

[INFO] Processing 'youtube-hiding-users'...
  - URL: https://support.google.com/youtube/answer/9482361
  - Renderer: playwright
  - SUCCESS: Snapshot saved to snapshots/youtube-hiding-users/2025-07-20T234945Z.html

[INFO] Processing 'whatnot-how-to-report'...
  - URL: https://help.whatnot.com/hc/en-us/articles/5380381014925-How-To-Report-A-User-How-We-Investigate
  - Renderer: playwright
  - SUCCESS: Snapshot saved to snapshots/whatnot-how-to-report/2025-07-20T234949Z.html

[INFO] Processing 'whatnot-blocking-a-user'...
  - URL: https://help.whatnot.com/hc/en-us/articles/9816865522317-Blocking-a-User
  - Renderer: playwright
  - SUCCESS: Snapshot saved to snapshots/whatnot-blocking-a-user/2025-07-20T234953Z.html

[INFO] Processing 'whatnot-enforcement-actions'...
  - URL: https://help.whatnot.com/hc/en-us/articles/5380505120269-What-Actions-We-Take
  - Renderer: playwright
  - SUCCESS: Snapshot saved to snapshots/whatnot-enforcement-actions/2025-07-20T234957Z.html

[INFO] Processing 'whatnot-buyer-protection'...
  - URL: https://help.whatnot.com/hc/en-us/articles/360061194552-Whatnot-Buyer-Protection-Policy
  - Renderer: playwright
  - SUCCESS: Snapshot saved to snapshots/whatnot-buyer-protection/2025-07-20T235001Z.html

[INFO] Processing 'whatnot-moderator-guidelines'...
  - URL: https://help.whatnot.com/hc/en-us/articles/6212550318477-Moderator-Guidelines
  - Renderer: playwright
  - SUCCESS: Snapshot saved to snapshots/whatnot-moderator-guidelines/2025-07-20T235005Z.html

[INFO] Processing 'internal-test-page'...
  - URL: test-page/index.html
  - Renderer: httpx
Failure details written to failures.log
0s
Run git config user.name "Policy Watch Bot"
[main 87935e1] CHORE: Update T&S policy snapshots
 18 files changed, 27423 insertions(+)
 create mode 100644 snapshots/instagram-appeal-process/2025-07-20T234932Z.html
 create mode 100644 snapshots/instagram-blocking-people/2025-07-20T234940Z.html
 create mode 100644 snapshots/instagram-commerce-policies/2025-07-20T234936Z.html
 create mode 100644 snapshots/instagram-community-guidelines/2025-07-20T234927Z.html
 create mode 100644 snapshots/tiktok-blocking-users/2025-07-20T234923Z.html
 create mode 100644 snapshots/tiktok-community-guidelines/2025-07-20T234910Z.html
 create mode 100644 snapshots/tiktok-live-moderation/2025-07-20T234915Z.html
 create mode 100644 snapshots/tiktok-shop-prohibited-products/2025-07-20T234919Z.html
 create mode 100644 snapshots/whatnot-blocking-a-user/2025-07-20T234953Z.html
 create mode 100644 snapshots/whatnot-buyer-protection/2025-07-20T235001Z.html
 create mode 100644 snapshots/whatnot-enforcement-actions/2025-07-20T234957Z.html
 create mode 100644 snapshots/whatnot-hate-and-harassment/2025-07-20T234900Z.html
 create mode 100644 snapshots/whatnot-how-to-report/2025-07-20T234949Z.html
 create mode 100644 snapshots/whatnot-moderator-guidelines/2025-07-20T235005Z.html
 create mode 100644 snapshots/youtube-community-guidelines/2025-07-20T234940Z.html
 create mode 100644 snapshots/youtube-harassment-policy/2025-07-20T234941Z.html
 create mode 100644 snapshots/youtube-hiding-users/2025-07-20T234945Z.html
 create mode 100644 snapshots/youtube-shopping-ads-policy/2025-07-20T234941Z.html
0s
Run git pull origin main --rebase
  git pull origin main --rebase
  shell: /usr/bin/bash -e {0}
  env:
    pythonLocation: /opt/hostedtoolcache/Python/3.11.13/x64
    PKG_CONFIG_PATH: /opt/hostedtoolcache/Python/3.11.13/x64/lib/pkgconfig
    Python_ROOT_DIR: /opt/hostedtoolcache/Python/3.11.13/x64
    Python2_ROOT_DIR: /opt/hostedtoolcache/Python/3.11.13/x64
    Python3_ROOT_DIR: /opt/hostedtoolcache/Python/3.11.13/x64
    LD_LIBRARY_PATH: /opt/hostedtoolcache/Python/3.11.13/x64/lib
From https://github.com/lyori6/ts-policy-watcher
 * branch            main       -> FETCH_HEAD
Current branch main is up to date.
1s
2m 27s
Run python scripts/diff_and_notify.py
  python scripts/diff_and_notify.py
  shell: /usr/bin/bash -e {0}
  env:
    pythonLocation: /opt/hostedtoolcache/Python/3.11.13/x64
    PKG_CONFIG_PATH: /opt/hostedtoolcache/Python/3.11.13/x64/lib/pkgconfig
    Python_ROOT_DIR: /opt/hostedtoolcache/Python/3.11.13/x64
    Python2_ROOT_DIR: /opt/hostedtoolcache/Python/3.11.13/x64
    Python3_ROOT_DIR: /opt/hostedtoolcache/Python/3.11.13/x64
    LD_LIBRARY_PATH: /opt/hostedtoolcache/Python/3.11.13/x64/lib
    GEMINI_API_KEY: ***
    GEMINI_API_KEY_2: ***
    RESEND_API_KEY: ***
    RECIPIENT_EMAIL: ***
    COMMIT_SHA: 87935e1fc0221bcc562d391dcd47eb8c7b3edb0b
  
--- Starting Differ and Notifier Script ---
Detected 18 changed policy files.
Processing: snapshots/instagram-appeal-process/2025-07-20T234932Z.html (existing policy)
Generated update summary for existing policy: instagram-appeal-process
Processing: snapshots/instagram-blocking-people/2025-07-20T234940Z.html (existing policy)
Generated update summary for existing policy: instagram-blocking-people
Processing: snapshots/instagram-commerce-policies/2025-07-20T234936Z.html (existing policy)
Generated update summary for existing policy: instagram-commerce-policies
Processing: snapshots/instagram-community-guidelines/2025-07-20T234927Z.html (existing policy)
Generated update summary for existing policy: instagram-community-guidelines
Processing: snapshots/tiktok-blocking-users/2025-07-20T234923Z.html (existing policy)
Generated update summary for existing policy: tiktok-blocking-users
Processing: snapshots/tiktok-community-guidelines/2025-07-20T234910Z.html (existing policy)
Generated update summary for existing policy: tiktok-community-guidelines
Processing: snapshots/tiktok-live-moderation/2025-07-20T234915Z.html (existing policy)
Generated update summary for existing policy: tiktok-live-moderation
Processing: snapshots/tiktok-shop-prohibited-products/2025-07-20T234919Z.html (existing policy)
Generated update summary for existing policy: tiktok-shop-prohibited-products
Processing: snapshots/whatnot-blocking-a-user/2025-07-20T234953Z.html (existing policy)
Generated update summary for existing policy: whatnot-blocking-a-user
Processing: snapshots/whatnot-buyer-protection/2025-07-20T235001Z.html (existing policy)
Generated update summary for existing policy: whatnot-buyer-protection
Processing: snapshots/whatnot-enforcement-actions/2025-07-20T234957Z.html (existing policy)
Generated update summary for existing policy: whatnot-enforcement-actions
Processing: snapshots/whatnot-hate-and-harassment/2025-07-20T234900Z.html (existing policy)
Generated update summary for existing policy: whatnot-hate-and-harassment
Processing: snapshots/whatnot-how-to-report/2025-07-20T234949Z.html (existing policy)
Generated update summary for existing policy: whatnot-how-to-report
Processing: snapshots/whatnot-moderator-guidelines/2025-07-20T235005Z.html (existing policy)
Generated update summary for existing policy: whatnot-moderator-guidelines
Processing: snapshots/youtube-community-guidelines/2025-07-20T234940Z.html (existing policy)
Generated update summary for existing policy: youtube-community-guidelines
Processing: snapshots/youtube-harassment-policy/2025-07-20T234941Z.html (existing policy)
Generated update summary for existing policy: youtube-harassment-policy
Processing: snapshots/youtube-hiding-users/2025-07-20T234945Z.html (existing policy)
Generated update summary for existing policy: youtube-hiding-users
Processing: snapshots/youtube-shopping-ads-policy/2025-07-20T234941Z.html (existing policy)
Generated update summary for existing policy: youtube-shopping-ads-policy
Successfully updated summaries.json.
Successfully sent email notification. Message ID: dbc6bfda-ae5d-4d4b-8c09-ebc4ced0f599
Successfully logged run status to run_log.json
--- Differ and Notifier Script Finished ---
0s
Run git config user.name "Policy Watch Bot"
[main 075c113] CHORE: Update policy summaries and run log
 2 files changed, 43 insertions(+), 36 deletions(-)
Successfully committed summary artifacts.
0s
Run git pull origin main --rebase
From https://github.com/lyori6/ts-policy-watcher
 * branch            main       -> FETCH_HEAD
   d10a4c3..87935e1  main       -> origin/main
Current branch main is up to date.
0s
Run ad-m/github-push-action@master
Push to branch main
To https://github.com/lyori6/ts-policy-watcher.git
   87935e1..075c113  HEAD -> main
1s
Post job cleanup.
0s
Post job cleanup.
/usr/bin/git version
git version 2.50.1
Temporarily overriding HOME='/home/runner/work/_temp/d6e36373-7839-4d07-a17b-7952aaeaf760' before making global git config changes
Adding repository directory to the temporary git global config as a safe directory
/usr/bin/git config --global --add safe.directory /home/runner/work/ts-policy-watcher/ts-policy-watcher
/usr/bin/git config --local --name-only --get-regexp core\.sshCommand
/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'core\.sshCommand' && git config --local --unset-all 'core.sshCommand' || :"
/usr/bin/git config --local --name-only --get-regexp http\.https\:\/\/github\.com\/\.extraheader
http.https://github.com/.extraheader
/usr/bin/git config --local --unset-all http.https://github.com/.extraheader
/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'http\.https\:\/\/github\.com\/\.extraheader' && git config --local --unset-all 'http.https://github.com/.extraheader' || :"