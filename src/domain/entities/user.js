class User {
    constructor(data) {
        this.id = data.id;
        this.username = data.username;
        this.name = data.name;
        this.email = data.email;
        this.password_hash = data.password_hash;
        this.birth_date = data.birth_date;
        this.is_active = data.is_active || true;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }

    /**
     * Converte para objeto seguro (sem senha)
     * @returns {Object} - Objeto do usuário sem informações sensíveis
     */
    toSafeObject() {
        return {
            id: this.id,
            username: this.username,
            name: this.name,
            email: this.email,
            birth_date: this.birth_date,
            is_active: this.is_active,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }

    /**
     * Converte para payload JWT
     * @returns {Object} - Payload para JWT
     */
    toJWTPayload() {
        return {
            id: this.id,
            username: this.username,
            email: this.email
        };
    }

    /**
     * Calcula a idade do usuário
     * @returns {number} - Idade em anos
     */
    getAge() {
        const birthDate = new Date(this.birth_date);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        return age;
    }
}

module.exports = User;