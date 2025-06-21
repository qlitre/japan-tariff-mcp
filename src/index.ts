import { Hono } from 'hono'
import mcpApp from './mcp'

const app = new Hono()
app.route('/mcp', mcpApp)

export default app
