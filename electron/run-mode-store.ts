import { promises as fs } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

export type RunMode = 'solo' | 'hub'

interface DesktopConfig {
  runMode: RunMode | null
}

function configPath(): string {
  return path.join(app.getPath('userData'), 'desktop-config.json')
}

async function readConfig(): Promise<DesktopConfig> {
  try {
    const raw = await fs.readFile(configPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<DesktopConfig>
    if (parsed.runMode === 'solo' || parsed.runMode === 'hub') {
      return { runMode: parsed.runMode }
    }
    return { runMode: null }
  } catch {
    return { runMode: null }
  }
}

async function writeConfig(cfg: DesktopConfig): Promise<void> {
  await fs.mkdir(path.dirname(configPath()), { recursive: true })
  await fs.writeFile(configPath(), JSON.stringify(cfg, null, 2), 'utf8')
}

export async function getRunMode(): Promise<RunMode | null> {
  const cfg = await readConfig()
  return cfg.runMode
}

export async function setRunMode(mode: RunMode): Promise<void> {
  await writeConfig({ runMode: mode })
}
