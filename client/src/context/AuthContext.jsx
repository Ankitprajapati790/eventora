import { createContext, useState, useEffect } from 'react';
import api from '../utils/axios';

const getErrorMessage = (error, fallback) => {
    const { message, emailProviderMessage } = error.response?.data || {};
    return [message, emailProviderMessage].filter(Boolean).join(' ') || fallback;
};

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const userInfo = localStorage.getItem('userInfo');
        if (userInfo) {
            setUser(JSON.parse(userInfo));
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        try {
            const { data } = await api.post('/auth/login', { email, password });
            setUser(data);
            localStorage.setItem('userInfo', JSON.stringify(data));
            localStorage.setItem('token', data.token);
            return data;
        } catch (error) {
            if (error.response?.data?.needsVerification) throw error.response.data;
            throw getErrorMessage(error, 'Login failed');
        }
    };

    const register = async (name, email, password) => {
        try {
            const { data } = await api.post('/auth/register', { name, email, password });
            return data; // Returns { message, email }
        } catch (error) {
            throw getErrorMessage(
                error,
                'Could not complete signup. Check your connection and retry signup with this email if the account is still unverified.'
            );
        }
    };

    const verifyOTP = async (email, otp) => {
        try {
            const { data } = await api.post('/auth/verify-otp', { email, otp });
            setUser(data);
            localStorage.setItem('userInfo', JSON.stringify(data));
            localStorage.setItem('token', data.token);
            return data;
        } catch (error) {
            throw getErrorMessage(error, 'OTP verification failed');
        }
    };

    const requestAdminChange = async (payload) => {
        try {
            const { data } = await api.post('/auth/request-admin-change', payload);
            return data;
        } catch (error) {
            throw getErrorMessage(error, 'Admin change request failed');
        }
    };

    const confirmAdminChange = async (payload) => {
        try {
            const { data } = await api.post('/auth/confirm-admin-change', payload);
            return data;
        } catch (error) {
            throw getErrorMessage(error, 'Admin change confirmation failed');
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('userInfo');
        localStorage.removeItem('token');
    };

    return (
        <AuthContext.Provider value={{ user, login, register, verifyOTP, requestAdminChange, confirmAdminChange, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
