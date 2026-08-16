# Todo App — EC2 Deployment Guide (with Git from scratch)

This project runs as ONE Express server on your EC2 instance — it serves the API
(`/api/todos`) and the built React frontend together, so you don't need S3 or
API Gateway for this version. It uses the same `todos` DynamoDB table you already created.

---

## Part 1 — Git, from zero

Git is a tool that tracks changes to your code over time and lets you upload
("push") it to GitHub, so you can later download ("clone") it onto your EC2 server.

### 1.1 Install Git on your Windows machine (if not already installed)
Check first:
```
git --version
```
If not recognized, download from https://git-scm.com/download/win and install
with default options (no admin rights needed if you choose "install for current
user only" during setup).

### 1.2 Create a GitHub account
Go to https://github.com and sign up (free) if you don't have an account.

### 1.3 Create a new empty repository on GitHub
1. Click the **+** icon (top right) → **New repository**
2. Name it `todo-ec2-app`
3. Keep it **Public** (simpler for now) or **Private** (fine too, just needs one extra login step later)
4. **Do NOT** check "Add a README" — you already have project files
5. Click **Create repository**
6. GitHub shows you a page with commands — keep that tab open, you'll need the URL shown (looks like `https://github.com/your-username/todo-ec2-app.git`)

### 1.4 Turn your local project folder into a Git project
Open Command Prompt, navigate into this project folder, then run these ONE AT A TIME:

```bash
cd path\to\todo-ec2-app
git init
git add .
git commit -m "Initial commit - todo app for EC2"
```

**What each command does:**
- `git init` → turns this folder into a Git-tracked project
- `git add .` → stages ALL files in this folder to be saved (the `.` means "everything")
- `git commit -m "..."` → actually saves a snapshot, with a short message describing it

### 1.5 Connect your local project to the GitHub repo and upload it
```bash
git remote add origin https://github.com/your-username/todo-ec2-app.git
git branch -M main
git push -u origin main
```

**What each command does:**
- `git remote add origin <url>` → tells Git "this is where to upload to," nicknamed `origin`
- `git branch -M main` → names your main line of code `main` (GitHub's default expectation)
- `git push -u origin main` → actually uploads your committed files to GitHub

If prompted, log in with your GitHub username and a **Personal Access Token** (not your password — GitHub requires this now). To create one: GitHub → your profile picture → Settings → Developer settings → Personal access tokens → Generate new token (classic) → check the "repo" scope → generate → copy it and paste it in place of a password when prompted.

### 1.6 Confirm it worked
Refresh your GitHub repository page in the browser — you should see all your project files listed there now.

---

## Part 2 — Clone it onto your EC2 instance

Connect to your EC2 instance (via the browser Connect button or `ssh`), then run:

```bash
sudo apt-get install -y git
git clone https://github.com/your-username/todo-ec2-app.git
cd todo-ec2-app
```

If your repo is Private, it'll ask for your GitHub username + the same Personal Access Token from step 1.5.

---

## Part 3 — Give this EC2 instance permission to use DynamoDB

Unlike Lambda, EC2 doesn't automatically have an execution role — you attach one manually, and instead of putting access keys on the server (insecure), you attach an IAM Role directly to the EC2 instance itself.

1. Console → IAM → Roles → **Create role**
2. Trusted entity type: **AWS service** → Use case: **EC2** → Next
3. Search and attach: create a custom policy (or reuse the `dynamodb-policy.json` from earlier) granting `dynamodb:PutItem`, `GetItem`, `Scan`, `UpdateItem`, `DeleteItem` on your `todos` table
4. Name the role e.g. `EC2-Todo-DynamoDB-Role` → Create role
5. Go to **EC2 → Instances** → select your instance → **Actions → Security → Modify IAM role**
6. Choose `EC2-Todo-DynamoDB-Role` → Update IAM role

Now your server can talk to DynamoDB without any access keys stored on it — the SDK detects this role automatically.

---

## Part 4 — Install dependencies and build the frontend

Back in your EC2 terminal, still inside `todo-ec2-app`:

```bash
npm install
cd frontend
npm install
npm run build
cd ..
```

`npm run build` compiles the React app and places the output directly into the `public/` folder (already configured in `frontend/package.json`), which `server.js` is set up to serve automatically.

---

## Part 5 — Run the server

Quick test run:
```bash
npm start
```
You should see: `Todo server running on port 3000`

Press `Ctrl+C` to stop it for now — for real use, we want it running in the background permanently (see Part 7).

---

## Part 6 — Open port 3000 to the internet

By default, your EC2 security group only allows SSH (port 22). You need to open port 3000 too:

1. Console → EC2 → Instances → click your instance → **Security** tab → click the security group link
2. **Edit inbound rules** → **Add rule**
3. Type: **Custom TCP**, Port range: **3000**, Source: **Anywhere (0.0.0.0/0)** — or "My IP" if you only want yourself to access it
4. Save rules

Now visit `http://YOUR_INSTANCE_PUBLIC_IP:3000` in your browser — you should see your Todo app live.

---

## Part 7 — Keep it running permanently with PM2

Right now, closing your terminal kills the server. PM2 keeps it running in the background even after you disconnect.

```bash
sudo npm install -g pm2
pm2 start server.js --name todo-app
pm2 save
pm2 startup
```
The last command prints another command — copy and run that exact line it gives you (it registers PM2 to auto-start on reboot).

**Useful PM2 commands going forward:**
```bash
pm2 status          # see if it's running
pm2 logs todo-app    # view live logs
pm2 restart todo-app # restart after code changes
pm2 stop todo-app    # stop it
```

---

## Making changes later (the normal workflow)

1. Edit code on your own computer (in Cursor/VS Code)
2. `git add .` → `git commit -m "describe the change"` → `git push`
3. On EC2: `git pull` → (rebuild frontend if you changed it) → `pm2 restart todo-app`

---

## Cleanup (avoid charges)
```bash
pm2 stop todo-app
```
Then from EC2 console: **Instance state → Stop** (pauses billing) or **Terminate** (deletes entirely).
Don't forget the DynamoDB table cleanup too if you're fully done: `aws dynamodb delete-table --table-name todos`
