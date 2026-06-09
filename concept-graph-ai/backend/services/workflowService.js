/**
 * Workflow Orchestration Service
 *
 * OLLAMA AI-POWERED PIPELINE
 * Every step calls Ollama — zero rule-based fallbacks in the happy path.
 *
 * Flow:
 * Upload → Extract Text → [Ollama] Topics → [Ollama] Dependencies → Graph → Save
 *                        → [Ollama] ConceptGraph (atomic concepts + prereq edges)
 *                        → [Ollama] MindMap     (heading hierarchy — NCERT mode)
 * Quiz:    [Ollama] Questions → Student Answers → [Ollama] Evaluate → [Ollama] Weakness → Save
 */

const textExtractionService   = require('./textExtractionService');
const topicExtractionService  = require('./topicExtractionService');
const questionGenerationService = require('./questionGenerationService');
const answerEvaluationService = require('./answerEvaluationService');
const dependencyAnalysisService = require('./dependencyAnalysisService');
const weaknessAnalysisService = require('./weaknessAnalysisService');
const mongoService            = require('./mongoService');
const conceptGraphService     = require('./conceptGraphService');

/* ═══════════════════════════════════════════════════════════════════════════
   PHASE 1: Document Processing Workflow
══════════════════════════════════════════════════════════════════════════════ */
const processingWorkflow = {

  /** Step 1 — extract raw text from uploaded file */
  extractText: async (filePath, mimeType) => {
    console.log('\n📄 STEP 1: Extracting text from document...');
    const result = await textExtractionService.extractText(filePath, mimeType);
    if (!result?.text) throw new Error(`No text extracted. Details: ${JSON.stringify(result)}`);
    const text = result.text;
    console.log(`✅ Extracted ${text.length} characters (${text.split(/\s+/).length} words)`);
    return { success: true, text, stats: { length: text.length, words: text.split(/\s+/).length } };
  },

  /** Step 2 — Gemini extracts topics + subtopics from the raw text */
  extractTopics: async (text) => {
    console.log('\n✨ STEP 2: Extracting topics with Gemini...');
    const topicData = await topicExtractionService.identifyTopicsAndSubtopics(text);
    const topics = topicData.mainTopics || [];
    if (topics.length === 0) throw new Error('Gemini returned no topics');
    console.log(`✅ Extracted ${topics.length} topics: ${topics.slice(0, 3).join(', ')}...`);
    return {
      success: true,
      topics,
      topicsData:    topicData.topicsData || [],
      subject:       topicData.subject    || '',
      summary:       topicData.summary    || '',
      keyTerms:      topicData.keyTerms   || [],
      relationships: topicData.relationships || [],
      stats: { count: topics.length },
    };
  },

  /** Step 3 — Gemini maps prerequisite dependencies across topics */
  analyzeDependencies: async (topics, docText = '') => {
    console.log('\n🔗 STEP 3: Analysing dependencies with Gemini...');
    const result = await dependencyAnalysisService.analyzeDependencies(topics, docText);
    const relationships = result.relationships || [];
    console.log(`✅ Found ${relationships.length} dependency relationships`);
    return {
      success: true,
      relationships,
      recommendedOrder: result.recommendedOrder || [],
      criticalPath:     result.criticalPath     || [],
      graph:            result.graph            || { nodes: [], edges: [] },
      stats: { count: relationships.length },
    };
  },

  /** Step 4 — Build the visual concept graph from AI output */
  createGraph: async (topicsData, relationships, subject = '') => {
    console.log('\n📊 STEP 4: Creating concept graph...');

    const nodes = topicsData.map((topic, index) => ({
      id:       index,
      label:    typeof topic === 'string' ? topic : topic.name,
      title:    typeof topic === 'object' && topic.description ? topic.description : (typeof topic === 'string' ? topic : topic.name),
      subtopics: typeof topic === 'object' ? (topic.subtopics || []) : [],
      color:    '#6366f1',
    }));

    const topicNames = nodes.map(n => n.label);

    const edges = relationships.map((rel, index) => {
      const fromIdx = topicNames.indexOf(rel.source);
      const toIdx   = topicNames.indexOf(rel.target);
      return {
        id:     index,
        from:   fromIdx >= 0 ? fromIdx : 0,
        to:     toIdx   >= 0 ? toIdx   : 0,
        label:  rel.type || 'relates to',
        arrows: 'to',
      };
    }).filter(e => e.from !== e.to);

    const graphData = {
      nodes,
      edges,
      metadata: {
        subject:           subject,
        topicCount:        nodes.length,
        relationshipCount: edges.length,
        createdAt:         new Date().toISOString(),
      },
    };

    console.log('✅ Graph created successfully');
    return { success: true, graph: graphData };
  },

  /** Complete document processing pipeline (Steps 1–4 + save) */
  processDocument: async (filePath, mimeType, userId) => {
    console.log('\n🚀 Starting FULL GEMINI Document Processing Pipeline...\n');

    // 1. Extract text
    const extractResult = await processingWorkflow.extractText(filePath, mimeType);

    // 2. Run ALL three pipelines concurrently:
    //    A) Concept graph pipeline  (atomic concepts + prerequisite edges)
    //    B) Mind map pipeline       (heading hierarchy, NCERT/chapter mode) ← NEW
    //    C) Legacy topic extraction (for backward compat + question generation)
    console.log('\n⚡ Running concept graph + mind map + topic extraction in parallel...');
    const [conceptGraphResult, mindMapResult, topicsResult] = await Promise.allSettled([
      conceptGraphService.buildConceptGraph(extractResult.text),
      conceptGraphService.buildMindMap(extractResult.text),      // ← NEW
      processingWorkflow.extractTopics(extractResult.text),
    ]);

    const { conceptGraph, topicsDataCompat } =
      conceptGraphResult.status === 'fulfilled' ? conceptGraphResult.value : { conceptGraph: null, topicsDataCompat: null };

    // Unwrap mind map result
    const { mindMap } =
      mindMapResult.status === 'fulfilled' ? mindMapResult.value : { mindMap: null };

    const topicsData = topicsResult.status === 'fulfilled'
      ? topicsResult.value
      : { topics: [], topicsData: topicsDataCompat?.topics || [], subject: '', summary: '', keyTerms: [], relationships: [] };

    if (conceptGraph) {
      console.log(`✅ Concept graph ready: ${conceptGraph.nodes.length} concepts, ${conceptGraph.edges.length} edges`);
    } else {
      console.warn('⚠️  Concept graph failed — session will use legacy graph only');
    }

    if (mindMap) {
      console.log(`✅ Mind map ready: ${mindMap.nodes.length} nodes, ${mindMap.edges.length} edges — "${mindMap.chapterTitle}"`);
    } else {
      console.warn('⚠️  Mind map failed — session will not have heading-based map');
    }

    // 3. Gemini: dependencies (pass full text for context)
    const depsResult = await processingWorkflow.analyzeDependencies(
      topicsData.topicsData?.length > 0 ? topicsData.topicsData : topicsData.topics,
      extractResult.text
    );

    // 4. Build graph
    const graphResult = await processingWorkflow.createGraph(
      topicsData.topicsData?.length > 0 ? topicsData.topicsData : topicsData.topics,
      depsResult.relationships,
      topicsData.subject
    );

    // 5. Save to MongoDB
    console.log('\n💾 STEP 5: Saving to database...');
    const saveResult = await mongoService.saveGraphData(userId, {
      fileName:         filePath.split(/[\/\\]/).pop(),
      text:             extractResult.text.substring(0, 10000),
      topics:           topicsData.topics,
      topicsData:       topicsData.topicsData,
      subject:          topicsData.subject,
      summary:          topicsData.summary,
      keyTerms:         topicsData.keyTerms,
      relationships:    depsResult.relationships,
      recommendedOrder: depsResult.recommendedOrder,
      criticalPath:     depsResult.criticalPath,
      graph:            graphResult.graph,
      conceptGraph:     conceptGraph || null,
      mindMap:          mindMap      || null,   // ← NEW
      textStats:        extractResult.stats,
      topicsDataStr:    (topicsData.topics || []).join(', '),
      extractedText:    extractResult.text.substring(0, 1000),
    });
    console.log('✅ Data saved successfully');

    console.log('\n✨ Document Processing Pipeline Complete!\n');

    return {
      success: true,
      phase: 'processing',
      data: {
        text:             extractResult.text,
        topics:           topicsData.topics,
        topicsData:       topicsData.topicsData,
        subject:          topicsData.subject,
        summary:          topicsData.summary,
        keyTerms:         topicsData.keyTerms,
        relationships:    depsResult.relationships,
        recommendedOrder: depsResult.recommendedOrder,
        criticalPath:     depsResult.criticalPath,
        graph:            graphResult.graph,
        conceptGraph:     conceptGraph || null,
        mindMap:          mindMap      || null,   // ← NEW
        graphId:          saveResult.id,
      },
      summary: {
        textLength:          extractResult.stats.length,
        topicsCount:         topicsData.topics?.length ?? 0,
        relationshipsCount:  depsResult.stats.count,
        mindMapNodes:        mindMap?.nodes?.length ?? 0,   // ← NEW
        savedAt:             saveResult.timestamp,
      },
    };
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   PHASE 2: Quiz & Learning Workflow
══════════════════════════════════════════════════════════════════════════════ */
const quizWorkflow = {

  /** Gemini generates document-grounded questions */
  generateQuestions: async (topicsData, docText = '') => {
    console.log('\n✨ QUIZ STEP 1: Generating questions with Gemini...');
    const result = await questionGenerationService.generateQuestions(topicsData, docText);
    const questions = result.questions || [];
    console.log(`✅ Generated ${questions.length} Gemini questions`);
    return { success: true, questions, stats: { count: questions.length } };
  },

  /** Gemini evaluates the student's answer */
  evaluateAnswer: async (question, userAnswer, topic) => {
    console.log('\n✨ QUIZ STEP 2: Evaluating answer with Gemini...');
    const evaluation = await answerEvaluationService.evaluateAnswer(userAnswer, question, topic);
    console.log(`✅ Evaluation: ${evaluation.rating} (score: ${evaluation.score ?? '?'})`);
    return { success: true, evaluation };
  },

  /** Gemini performs root-cause weakness analysis */
  analyzeWeaknesses: async (evaluation, allTopics = []) => {
    console.log('\n✨ QUIZ STEP 3: Analysing weaknesses with Gemini...');
    if (evaluation.rating !== 'weak' && evaluation.rating !== 'partial') {
      return { success: true, analysis: { category: 'strong', recommendation: 'Keep it up!' } };
    }
    const topic = evaluation.topic || 'Unknown topic';
    const analysis = await weaknessAnalysisService.traceDependencyWeakness(topic, allTopics, { [topic]: evaluation });
    console.log('✅ Weakness analysis complete');
    return { success: true, analysis };
  },

  updateProgress: async (userId, topic, evaluation) => {
    console.log('\n📈 QUIZ STEP 4: Updating user progress in MongoDB...');
    const topicKey = topic.toLowerCase().replace(/\s+/g, '_');
    await mongoService.updateUserProgress(userId, {
      [`topics.${topicKey}`]: {
        rating:       evaluation.rating,
        score:        evaluation.score ?? 0,
        confidence:   evaluation.confidence ?? 0,
        masteryLevel: evaluation.rating === 'strong'  ? 'advanced'
                    : evaluation.rating === 'partial' ? 'intermediate'
                    : 'beginner',
        attempts:     1,
        lastPracticed: new Date(),
      },
    });
    console.log(`✅ Progress updated for topic: ${topic}`);
    return { success: true, progress: { topic, rating: evaluation.rating, score: evaluation.score } };
  },

  saveResult: async (userId, quizResult) => {
    console.log('\n💾 QUIZ STEP 5: Saving quiz result to MongoDB...');
    const result = await mongoService.saveQuizResult(userId, quizResult);
    console.log(`✅ Quiz result saved: ${result.id}`);
    return { success: true, resultId: result.id };
  },

  processQuizAnswer: async (userId, quizData) => {
    console.log('\n🚀 Starting FULL GEMINI Quiz Processing Pipeline...\n');

    const evalResult = await quizWorkflow.evaluateAnswer(
      quizData.question,
      quizData.userAnswer,
      quizData.topic
    );
    if (!evalResult.success) throw new Error('Evaluation failed');

    const weakResult = await quizWorkflow.analyzeWeaknesses(
      { ...evalResult.evaluation, topic: quizData.topic },
      quizData.allTopics || []
    );

    const progressResult = await quizWorkflow.updateProgress(userId, quizData.topic, evalResult.evaluation);
    if (!progressResult.success) throw new Error('Progress update failed');

    const saveResult = await quizWorkflow.saveResult(userId, {
      question:   quizData.question,
      userAnswer: quizData.userAnswer,
      topic:      quizData.topic,
      rating:     evalResult.evaluation.rating,
      confidence: quizData.confidence || 0,
    });
    if (!saveResult.success) throw new Error('Result saving failed');

    console.log('\n✨ Quiz Processing Pipeline Complete!\n');

    return {
      success: true,
      phase: 'quiz',
      data: {
        evaluation: evalResult.evaluation,
        progress:   progressResult.progress,
        weakness:   weakResult.analysis,
        resultId:   saveResult.resultId,
      },
      summary: {
        rating:     evalResult.evaluation.rating,
        score:      evalResult.evaluation.score,
        confidence: evalResult.evaluation.confidence,
      },
    };
  },
};

module.exports = { processingWorkflow, quizWorkflow };