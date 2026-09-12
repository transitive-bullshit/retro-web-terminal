import type { Bash, BashExecResult, CommandName } from 'just-bash/browser'

import { home, seedFiles } from './files'

const commands: CommandName[] = [
  'echo',
  'cat',
  'printf',
  'ls',
  'mkdir',
  'rmdir',
  'touch',
  'rm',
  'cp',
  'mv',
  'ln',
  'chmod',
  'pwd',
  'readlink',
  'head',
  'tail',
  'wc',
  'stat',
  'grep',
  'fgrep',
  'egrep',
  'rg',
  'sed',
  'awk',
  'sort',
  'uniq',
  'comm',
  'cut',
  'paste',
  'tr',
  'rev',
  'nl',
  'fold',
  'expand',
  'unexpand',
  'strings',
  'split',
  'column',
  'join',
  'tee',
  'find',
  'basename',
  'dirname',
  'tree',
  'du',
  'env',
  'printenv',
  'alias',
  'unalias',
  'xargs',
  'true',
  'false',
  'clear',
  'bash',
  'sh',
  'jq',
  'base64',
  'diff',
  'date',
  'sleep',
  'timeout',
  'seq',
  'expr',
  'md5sum',
  'sha1sum',
  'sha256sum',
  'file',
  'help',
  'which',
  'tac',
  'hostname',
  'od',
  'time',
  'whoami'
]

export class BrowserShell {
  private bash: Promise<Bash> | undefined
  private pending: Promise<unknown> = Promise.resolve()
  private cwd = home
  private oldCwd = home

  getCwd() {
    return this.cwd
  }

  private load() {
    this.bash ??= import('just-bash/browser').then(
      ({ Bash: BashRuntime }) =>
        new BashRuntime({
          files: seedFiles,
          cwd: home,
          env: { HOME: home, USER: 'visitor', TERM: 'xterm-256color' },
          commands,
          executionLimits: {
            maxCommandCount: 2000,
            maxLoopIterations: 10000,
            maxOutputSize: 256 * 1024
          }
        })
    )
    return this.bash
  }

  run(command: string, signal: AbortSignal): Promise<BashExecResult> {
    // Serialize even canceled work: cancellation is cooperative, and the filesystem is shared.
    const operation = this.pending
      .catch(() => {})
      .then(async () => {
        const bash = await this.load()
        signal.throwIfAborted()
        const result = await bash.exec(command, {
          cwd: this.cwd,
          env: { PWD: this.cwd, OLDPWD: this.oldCwd },
          rawScript: true,
          signal
        })
        signal.throwIfAborted()
        const nextCwd = result.env.PWD
        if (nextCwd && nextCwd !== this.cwd) {
          try {
            if ((await bash.fs.stat(nextCwd)).isDirectory) {
              this.oldCwd = this.cwd
              this.cwd = nextCwd
            }
          } catch {
            // A command may delete its own directory; retain the last known location.
          }
        }
        if (result.env.OLDPWD) this.oldCwd = result.env.OLDPWD
        return result
      })
    this.pending = operation
    return operation
  }

  async complete(path: string) {
    const bash = await this.load()
    const expanded =
      path === '~' ? home : path.startsWith('~/') ? home + path.slice(1) : path
    const slash = expanded.lastIndexOf('/')
    const directory = slash < 0 ? '.' : expanded.slice(0, slash + 1) || '/'
    const prefix = expanded.slice(slash + 1)
    const absolute = bash.fs.resolvePath(this.cwd, directory)
    try {
      const names = (await bash.fs.readdir(absolute))
        .filter(
          (name) =>
            name.startsWith(prefix) &&
            (prefix.startsWith('.') || !name.startsWith('.'))
        )
        .sort()
      return await Promise.all(
        names.map(async (name) => {
          const stat = await bash.fs.stat(bash.fs.resolvePath(absolute, name))
          return name + (stat.isDirectory ? '/' : '')
        })
      )
    } catch {
      return []
    }
  }
}
