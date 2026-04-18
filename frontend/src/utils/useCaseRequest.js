/**
 * Build POST /api/generate-usecases JSON body.
 * Server accepts only textual use case text produced in the same SRS model completion
 * (source model_prompt_appendix); it echoes that text and builds the diagram only.
 */
export function buildGenerateUseCasesRequestBody(srsData) {
  if (!srsData) {
    return {};
  }
  const base = {
    document_id: srsData.document_id,
    title: srsData.title,
    sections: srsData.sections || {},
  };
  const tu = srsData.textual_usecases;
  if (
    tu &&
    tu.co_generated &&
    String(tu.source || '') === 'model_prompt_appendix' &&
    String(tu.text || '').trim()
  ) {
    base.textual_usecases = {
      use_cases: tu.use_cases || [],
      text: tu.text || '',
      co_generated: true,
      generated_with_document_id: tu.generated_with_document_id || srsData.document_id,
      source: 'model_prompt_appendix',
    };
  }
  return base;
}

/** True when SRS response included the model appendix for textual use cases */
export function hasModelTextualUseCases(srsData) {
  const tu = srsData?.textual_usecases;
  return (
    !!tu &&
    tu.co_generated === true &&
    String(tu.source || '') === 'model_prompt_appendix' &&
    String(tu.text || '').trim().length > 0
  );
}
