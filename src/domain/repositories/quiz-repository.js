const { supabase } = require('../../infrastructure/database/supabase-client');
const { QuizResult, QuizAnswer } = require('../entities/quiz');

class QuizRepository {
    /**
     * Salvar resultado do quiz
     * @param {Object} quizData - Dados do resultado do quiz
     * @returns {Promise<QuizResult>} - Resultado salvo
     */
    async saveQuizResult(quizData) {
        const { data, error } = await supabase
            .from('quiz_results')
            .insert([quizData])
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao salvar resultado do quiz: ${error.message}`);
        }

        return new QuizResult(data);
    }

    /**
     * Salvar respostas do quiz
     * @param {Array} answersData - Array de respostas
     * @returns {Promise<Array<QuizAnswer>>} - Respostas salvas
     */
    async saveQuizAnswers(answersData) {
        const { data, error } = await supabase
            .from('quiz_answers')
            .insert(answersData)
            .select();

        if (error) {
            throw new Error(`Erro ao salvar respostas do quiz: ${error.message}`);
        }

        return data.map(answer => new QuizAnswer(answer));
    }

    /**
     * Buscar resultado do quiz por usuário
     * @param {string} userId - ID do usuário
     * @returns {Promise<QuizResult|null>} - Resultado encontrado ou null
     */
    async findQuizResultByUserId(userId) {
        const { data, error } = await supabase
            .from('quiz_results')
            .select('*')
            .eq('user_id', userId)
            .order('completed_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Erro ao buscar resultado do quiz: ${error.message}`);
        }

        return new QuizResult(data);
    }

    /**
     * Buscar respostas do quiz por usuário
     * @param {string} userId - ID do usuário
     * @returns {Promise<Array<QuizAnswer>>} - Respostas encontradas
     */
    async findQuizAnswersByUserId(userId) {
        const { data, error } = await supabase
            .from('quiz_answers')
            .select('*')
            .eq('user_id', userId)
            .order('answered_at', { ascending: true });

        if (error) {
            throw new Error(`Erro ao buscar respostas do quiz: ${error.message}`);
        }

        return data.map(answer => new QuizAnswer(answer));
    }

    /**
     * Verificar se usuário já completou o quiz
     * @param {string} userId - ID do usuário
     * @returns {Promise<boolean>} - True se já completou
     */
    async hasUserCompletedQuiz(userId) {
        const { data, error } = await supabase
            .from('quiz_results')
            .select('id')
            .eq('user_id', userId)
            .limit(1);

        if (error) {
            throw new Error(`Erro ao verificar quiz: ${error.message}`);
        }

        return data.length > 0;
    }

    /**
     * Salvar estado atribuído ao usuário
     * @param {Object} stateData - Dados do estado
     * @returns {Promise<Object>} - Estado salvo
     */
    async saveUserState(stateData) {
        // Desativar estado anterior se existir
        await supabase
            .from('user_states')
            .update({ is_active: false })
            .eq('user_id', stateData.user_id)
            .eq('is_active', true);

        const { data, error } = await supabase
            .from('user_states')
            .insert([stateData])
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao salvar estado do usuário: ${error.message}`);
        }

        return data;
    }

    /**
     * Buscar estado ativo do usuário
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object|null>} - Estado encontrado ou null
     */
    async findActiveUserState(userId) {
        const { data, error } = await supabase
            .from('user_states')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Erro ao buscar estado do usuário: ${error.message}`);
        }

        return data;
    }

    /**
 * Incrementar contador de reload usando RPC corrigido
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} - Estado atualizado
 */
async incrementReloadCount(userId) {
    const { data, error } = await supabase
        .rpc('increment_reload_count', { user_id_param: userId });

    if (error) {
        throw new Error(`Erro ao incrementar reload: ${error.message}`);
    }

    if (!data || data.length === 0) {
        throw new Error('Estado ativo não encontrado');
    }

    return data[0];
}
}

module.exports = QuizRepository;