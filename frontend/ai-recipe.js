// Safe JSON parse with fallback for AI responses
export function safeParseJSON(str) {
  if (!str) throw new Error('AI 返回内容为空，请重试');

  let trimmed = str.trim();

  // Remove markdown code block fences
  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '');
  }

  // Try direct parse
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    // Try to extract first JSON object from the response
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      let fixed = match[0];
      // Fix trailing commas before ] and }
      fixed = fixed.replace(/,\s*([\]}])/g, '$1');
      // Replace single-quoted keys with double-quoted keys (safe: keys are simple identifiers)
      fixed = fixed.replace(/'([^']+)'\s*:/g, '"$1":');
      // Replace single-quoted string values — be conservative, only when the value
      // looks like it doesn't contain nested single quotes that would break the match
      fixed = fixed.replace(/:\s*'([^'"]*)'\s*([,}\]])/g, ':"$1"$2');
      try {
        return JSON.parse(fixed);
      } catch (e2) {
        throw new Error('AI 返回格式异常，无法解析。请重试。');
      }
    }
    throw new Error('AI 返回格式异常，无法解析。请重试。');
  }
}

export function validateAiRecipe(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('AI 返回的菜谱结构不正确，请重试');
  }

  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!name || name.length > 100) throw new Error('AI 返回的菜名无效，请重试');

  if (!Array.isArray(value.ingredients) || value.ingredients.length < 1 || value.ingredients.length > 40) {
    throw new Error('AI 返回的食材列表不完整，请重试');
  }
  const ingredients = value.ingredients.map((ingredient, index) => {
    if (!ingredient || typeof ingredient !== 'object' || Array.isArray(ingredient)) {
      throw new Error(`AI 返回的第 ${index + 1} 项食材格式不正确`);
    }
    const ingredientName = typeof ingredient.name === 'string' ? ingredient.name.trim() : '';
    const amountSource = ingredient.amount;
    const amount = typeof amountSource === 'number'
      ? String(amountSource)
      : (typeof amountSource === 'string' ? amountSource.trim() : '');
    if (!ingredientName || ingredientName.length > 100) throw new Error(`AI 返回的第 ${index + 1} 项食材名称无效`);
    if (!amount || amount.length > 100) throw new Error(`AI 返回的食材「${ingredientName}」缺少有效用量`);
    return { name: ingredientName, amount, optional: ingredient.optional === true };
  });

  if (!Array.isArray(value.steps) || value.steps.length < 1 || value.steps.length > 30) {
    throw new Error('AI 返回的烹饪步骤不完整，请重试');
  }
  const steps = value.steps.map((step, index) => {
    if (typeof step !== 'string' || !step.trim() || step.trim().length > 2000) {
      throw new Error(`AI 返回的第 ${index + 1} 条步骤无效`);
    }
    return step.trim();
  });

  if (!Array.isArray(value.tags)) throw new Error('AI 返回的标签格式不正确，请重试');
  const tags = [...new Set(value.tags
    .map(tag => typeof tag === 'string' ? tag.trim() : '')
    .filter(Boolean))];
  if (tags.some(tag => tag.length > 30)) throw new Error('AI 返回的标签过长，请重试');

  if (value.notes !== undefined && typeof value.notes !== 'string') {
    throw new Error('AI 返回的备注格式不正确，请重试');
  }
  const notes = typeof value.notes === 'string' ? value.notes.trim() : '';
  if (notes.length > 5000) throw new Error('AI 返回的备注过长，请重试');

  return { name, ingredients, steps, tags: tags.slice(0, 3), notes };
}

