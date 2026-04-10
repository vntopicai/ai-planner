import archiver from 'archiver'
import { createWriteStream } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

export interface ZipOptions {
  sourceDir: string
  ignorePatterns?: string[]
}

const DEFAULT_IGNORE = [
  '.git/**',
  'node_modules/**',
  'dist/**',
  'build/**',
  'out/**',
  '.ai-planner/**',
  '.next/**',
  '.nuxt/**',
  'coverage/**',
  '*.log',
  '.DS_Store'
]

/**
 * Compresses a directory into a temporary ZIP file, ignoring heavy/unnecessary folders.
 * Returns the absolute path to the generated .zip file.
 */
export async function createProjectZip(options: ZipOptions): Promise<string> {
  const { sourceDir, ignorePatterns = [] } = options
  const outputPath = join(tmpdir(), `aip-repo-${randomUUID()}.zip`)

  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath)
    const archive = archiver('zip', {
      zlib: { level: 5 } // balanced compression
    })

    output.on('close', () => resolve(outputPath))
    archive.on('error', (err) => reject(err))

    archive.pipe(output)

    const ignore = [...DEFAULT_IGNORE, ...ignorePatterns]
    archive.glob('**/*', {
      cwd: sourceDir,
      ignore,
      dot: true,
    })

    archive.finalize()
  })
}
