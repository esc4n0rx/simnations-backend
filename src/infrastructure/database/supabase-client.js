const { createClient } = require('@supabase/supabase-js');

// Configuração do cliente Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL e Key são obrigatórias');
}

// Criar cliente Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// Função para testar conexão
async function testConnection() {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('count')
            .limit(1);
        
        if (error) throw error;
        
        console.log('✅ Conexão com Supabase estabelecida com sucesso');
        return true;
    } catch (error) {
        console.error('❌ Erro ao conectar com Supabase:', error.message);
        return false;
    }
}

module.exports = {
    supabase,
    testConnection
};