/**
 * Paul — builder specialist agent.
 * Focused on shipping code, wiring integrations, and local deployment.
 */

const { complete, loadIdentity } = require('../llm');
const graphify = require('../brain/graphify');
const { listTools, executeTool } = require('../tools/registry');

const PAUL_IDENTITY = `You are **Paul**, TONY's builder specialist.
You ship working code with minimal scope, match existing conventions, and prefer local-first deployment.
You understand graph structures, voice pipelines, and agent memory layers.
When building: plan briefly, execute tools, verify with tests, report what shipped.`;

async function build(task, sessionId, options = {}) {
  const graphContext = graphify.getContextForAgent(task.split(/\s+/)[0] || 'build');
  const tools = listTools();

  const messages = [
    {
      role: 'system',
      content: `${loadIdentity()}\n\n${PAUL_IDENTITY}\n\n${graphContext}`,
    },
    {
      role: 'user',
      content: `Build task: ${task}\n\nConstraints: ${options.constraints || 'Ship locally, keep diffs focused.'}`,
    },
  ];

  const toolResults = [];
  let iterations = 0;
  const maxIterations = options.maxIterations || 8;
  let finalContent = '';

  while (iterations < maxIterations) {
    iterations += 1;
    const result = await complete(messages, {
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
      temperature: 0.2,
    });

    if (result.toolCalls?.length) {
      for (const call of result.toolCalls) {
        const toolResult = await executeTool(call.name, call.arguments, sessionId);
        toolResults.push({ tool: call.name, result: toolResult });
        messages.push({ role: 'assistant', content: result.content || `Calling ${call.name}` });
        messages.push({
          role: 'user',
          content: `Tool ${call.name} result:\n${JSON.stringify(toolResult, null, 2)}`,
        });
      }
      continue;
    }

    finalContent = result.content || '';
    break;
  }

  return {
    agent: 'paul',
    role: 'builder',
    task,
    response: finalContent || 'Build cycle complete.',
    toolResults,
    iterations,
  };
}

function status() {
  return {
    name: 'Paul',
    role: 'builder',
    focus: ['integrations', 'local ship', 'graph wiring', 'voice pipeline'],
  };
}

module.exports = { build, status, PAUL_IDENTITY };
