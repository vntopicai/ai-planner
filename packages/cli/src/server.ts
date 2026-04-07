import express from 'express'
import cors from 'cors'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import {
  recommendSkills,
  installSkills,
  listInstalledSkills,
  removeSkills,
  runPlanningPipeline,
  detectTechStack,
  generateWiki
} from '@ai-planner/core'


/**
 * AI Planner Local API Server
 * Bridges the React Web Dashboard to the local Node environment (CLI tools).
 */
export function startServer(port = getApiPortFromEnv()) {
  const app = express()
  app.use(cors())
  app.use(express.json())
  const deepwikiUrl = process.env.AI_PLANNER_DEEPWIKI_URL || 'http://localhost:3000'

  const handleWikiGenerate: express.RequestHandler = async (req, res) => {
    try {
      const { repoUrl, localPath } = req.body

      const normalizedLocalPath = typeof localPath === 'string' && localPath.trim()
        ? resolve(localPath.trim())
        : undefined
      const wiki = await generateWiki({
        repoUrl: typeof repoUrl === 'string' ? repoUrl : undefined,
        localPath: normalizedLocalPath,
      })
      const savedWikiPath = normalizedLocalPath
        ? await saveGeneratedWiki(normalizedLocalPath, wiki.rawMarkdown)
        : undefined

      let techStack = [...wiki.techStack]
      if (normalizedLocalPath) {
        const localTech = await detectTechStack(normalizedLocalPath)
        techStack = [...new Set([...techStack, ...localTech])]
      }

      res.json({
        ...wiki,
        techStack,
        deepwikiUrl,
        normalizedLocalPath,
        savedWikiPath,
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }

  // Skills APIs
  app.post('/api/skills/recommend', async (req, res) => {
    try {
      const { techStack, context } = req.body
      const recommendations = await recommendSkills(techStack || [], context || '')
      res.json(recommendations)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/skills/installed', async (req, res) => {
    try {
      const agent = (req.query.agent as string) || 'antigravity'
      const skills = await listInstalledSkills(agent)
      res.json(skills)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/skills/install', async (req, res) => {
    try {
      const { skills, agent } = req.body
      if (!Array.isArray(skills)) {
        return res.status(400).json({ error: 'Skills array required' })
      }
      
      const targetAgent = agent || 'antigravity'
      const result = await installSkills(skills, targetAgent)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/skills/remove', async (req, res) => {
    try {
      const { skillName, agent } = req.body
      const targetAgent = agent || 'antigravity'
      await removeSkills([skillName], targetAgent)
      res.json({ success: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // Analyze Existing Project API
  // Keep the legacy route for old web bundles that still call /api/wiki/generate.
  app.post('/api/deepwiki/generate', handleWikiGenerate)
  app.post('/api/wiki/generate', handleWikiGenerate)

  // Planning API
  app.post('/api/plan', async (req, res) => {
    try {
      const { description } = req.body
      if (!description) return res.status(400).json({ error: 'Description required' })
      
      // For SSE support, we could use a custom response format.
      // But for simplicity, we'll just await the full result here in the MVP.
      const result = await runPlanningPipeline(description)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // Start Server
  const server = app.listen(port, () => {
    console.log(`Local AI Planner API running on http://localhost:${port}`)
  })
  
  return server
}

function getApiPortFromEnv(): number {
  const rawPort = process.env.AI_PLANNER_API_PORT || '5174'
  const port = Number.parseInt(rawPort, 10)
  return Number.isNaN(port) ? 5174 : port
}

async function saveGeneratedWiki(projectPath: string, markdown: string): Promise<string> {
  const wikiDir = join(projectPath, 'wikis')
  const filePath = join(wikiDir, `${basename(projectPath)}-wiki.md`)

  await mkdir(wikiDir, { recursive: true })
  await writeFile(filePath, markdown, 'utf8')

  return filePath
}
