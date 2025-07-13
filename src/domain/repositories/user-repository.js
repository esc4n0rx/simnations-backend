const { supabase } = require('../../infrastructure/database/supabase-client');
const User = require('../entities/user');

class UserRepository {
    /**
     * Criar novo usuário
     * @param {Object} userData - Dados do usuário
     * @returns {Promise<User>} - Usuário criado
     */
    async create(userData) {
        const { data, error } = await supabase
            .from('users')
            .insert([userData])
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao criar usuário: ${error.message}`);
        }

        return new User(data);
    }

    /**
     * Buscar usuário por ID
     * @param {string} id - ID do usuário
     * @returns {Promise<User|null>} - Usuário encontrado ou null
     */
    async findById(id) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .eq('is_active', true)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Erro ao buscar usuário: ${error.message}`);
        }

        return new User(data);
    }

    /**
     * Buscar usuário por username
     * @param {string} username - Nome de usuário
     * @returns {Promise<User|null>} - Usuário encontrado ou null
     */
    async findByUsername(username) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('is_active', true)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Erro ao buscar usuário: ${error.message}`);
        }

        return new User(data);
    }

    /**
     * Buscar usuário por email
     * @param {string} email - Email do usuário
     * @returns {Promise<User|null>} - Usuário encontrado ou null
     */
    async findByEmail(email) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .eq('is_active', true)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Erro ao buscar usuário: ${error.message}`);
        }

        return new User(data);
    }

    /**
     * Atualizar usuário
     * @param {string} id - ID do usuário
     * @param {Object} updateData - Dados para atualizar
     * @returns {Promise<User>} - Usuário atualizado
     */
    async update(id, updateData) {
        const { data, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao atualizar usuário: ${error.message}`);
        }

        return new User(data);
    }

    /**
     * Desativar usuário (soft delete)
     * @param {string} id - ID do usuário
     * @returns {Promise<boolean>} - True se desativado com sucesso
     */
    async deactivate(id) {
        const { error } = await supabase
            .from('users')
            .update({ is_active: false })
            .eq('id', id);

        if (error) {
            throw new Error(`Erro ao desativar usuário: ${error.message}`);
        }

        return true;
    }

    /**
     * Verificar se username existe
     * @param {string} username - Nome de usuário
     * @returns {Promise<boolean>} - True se existe
     */
    async usernameExists(username) {
        const { data, error } = await supabase
            .from('users')
            .select('id')
            .eq('username', username)
            .limit(1);

        if (error) {
            throw new Error(`Erro ao verificar username: ${error.message}`);
        }

        return data.length > 0;
    }

    /**
     * Verificar se email existe
     * @param {string} email - Email do usuário
     * @returns {Promise<boolean>} - True se existe
     */
    async emailExists(email) {
        const { data, error } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .limit(1);

        if (error) {
            throw new Error(`Erro ao verificar email: ${error.message}`);
        }

        return data.length > 0;
    }
}

module.exports = UserRepository;