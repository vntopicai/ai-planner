#!/usr/bin/env node
import 'dotenv/config'
import { Command } from 'commander'
import { bootstrapCommand } from './commands/bootstrap.js'
import { doctorCommand } from './commands/doctor.js'
import { existingCommand } from './commands/existing.js'
import { newCommand } from './commands/new.js'
import { skillsCommand } from './commands/skills.js'
import { uiCommand } from './commands/ui.js'

const program = new Command()

program
  .name('aip')
  .description('AI Planner Local - CLI-first local setup for agent-ready development environments')
  .version('0.1.0')

program.addCommand(bootstrapCommand)
program.addCommand(doctorCommand)
program.addCommand(existingCommand)
program.addCommand(newCommand)
program.addCommand(skillsCommand)
program.addCommand(uiCommand)

program.parse(process.argv)
