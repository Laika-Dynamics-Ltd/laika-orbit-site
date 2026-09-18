---
title: Other machines
description: Run chats, terminals and heavy builds on other machines on your network, over SSH.
---

Laika Orbit can send work to other machines you own: a Linux box under the desk, a spare Mac, a
build server. Chats and terminals run there, and heavy commands (Unity test runs, builds) run there
instead of pinning your laptop's CPU. There's no vendor cloud in between: your Mac talks to each
machine over SSH.

## Set up a machine

1. **Build the bundle** on your Mac, from your Laika Orbit checkout:

   ```bash
   pnpm node:bundle                                          # linux-x64 and linux-arm64
   node tools/node-bundle/build.mjs darwin-arm64 linux-x64   # or pick platforms
   ```

   Each archive carries Node, the agent host and Claude Code, so the machine needs nothing
   installed first.

2. **Install it on the machine**, as the user the sessions should run as:

   ```bash
   tar -xzf orbit-node-<platform>.tar.gz
   ./orbit-node-<platform>/install.sh
   ```

   It installs a service that starts with the machine, and asks for sudo only to install an SSH
   server or announce the machine on the network. On a machine with work of its own, use
   `./install.sh --capped` for one job at a time at the lowest CPU priority.

3. **Add it** from your Mac:

   ```bash
   node packages/app/offload.mjs add me@build-box        # or user@host:port, --name <name>
   node packages/app/offload.mjs discover                # machines announcing themselves
   ```

## Send work to it

```bash
node packages/app/offload.mjs run -- pnpm test          # any command, in a copy of this folder
node packages/app/offload.mjs unity -- -runTests …      # the project's Unity version
node packages/app/offload.mjs machines                  # which machines are online, and how busy
```

The folder is copied to the machine (changed files only), the command runs there, its output
streams back as it happens, and the files it wrote come back into the folder. With no `--on
<machine>`, the least busy machine that can run the command is picked.

## Security

- The bundle carries an SSH key made for Laika Orbit alone. The installer lets that key open a
  tunnel to the agent host and copy files into `~/orbit-work`, and nothing else: no shell, no other
  commands, no other folders.
- The agent host listens on the machine's loopback address only.
- Keep the bundle as private as an SSH key: it holds the token the agent host asks for.

To remove a machine: `node packages/app/offload.mjs remove <name>` on your Mac, and
`~/.local/share/orbit-node/uninstall.sh` on the machine (on macOS,
`~/Library/Application Support/orbit-node/uninstall.sh`).
