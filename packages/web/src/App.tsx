import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import WikiPage from './pages/WikiPage'
import SkillsPage from './pages/SkillsPage'
import PlanPage from './pages/PlanPage'
import Layout from './components/Layout'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/wiki" element={<WikiPage />} />
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/plan" element={<PlanPage />} />
      </Routes>
    </Layout>
  )
}
