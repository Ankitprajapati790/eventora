import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [showOTP, setShowOTP] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [roleMode, setRoleMode] = useState('user');
    const [adminChangeStep, setAdminChangeStep] = useState('details');
    const [adminCurrentEmail, setAdminCurrentEmail] = useState('');
    const [adminCurrentPassword, setAdminCurrentPassword] = useState('');
    const [adminNewEmail, setAdminNewEmail] = useState('');
    const [adminNewPassword, setAdminNewPassword] = useState('');

    const { login, verifyOTP, requestAdminChange, confirmAdminChange } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const loginEmail = email.trim();
            if (!showOTP) {
                const data = await login(loginEmail, password);
                if (data.role === 'admin') navigate('/admin');
                else navigate('/dashboard');
            } else {
                const data = await verifyOTP(loginEmail, otp);
                if (data.role === 'admin') navigate('/admin');
                else navigate('/dashboard');
            }
        } catch (err) {
            if (err.needsVerification) {
                setShowOTP(true);
                setError('Account not verified. A new OTP has been sent to your email.');
            } else {
                setError(err.message || err);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAdminChange = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (adminChangeStep === 'details') {
                await requestAdminChange({
                    currentEmail: adminCurrentEmail,
                    currentPassword: adminCurrentPassword,
                    newEmail: adminNewEmail,
                    newPassword: adminNewPassword
                });
                setAdminChangeStep('otp');
                setError('OTP sent to the current admin email. Verify it to update admin details.');
            } else {
                await confirmAdminChange({
                    currentEmail: adminCurrentEmail,
                    otp,
                    newEmail: adminNewEmail,
                    newPassword: adminNewPassword
                });
                setAdminChangeStep('details');
                setRoleMode('admin');
                setShowOTP(false);
                setError('Admin credentials updated successfully. Use the new admin email and password to sign in.');
            }
        } catch (err) {
            setError(err.message || err);
        } finally {
            setLoading(false);
        }
    };

    const resetAdminChangeForm = () => {
        setAdminChangeStep('details');
        setAdminCurrentEmail('');
        setAdminCurrentPassword('');
        setAdminNewEmail('');
        setAdminNewPassword('');
        setOtp('');
    };

    return (
        <div className="max-w-md mx-auto mt-20 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Welcome Back</h2>
                <p className="text-gray-500">Sign in to your Eventora account</p>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-6 rounded-xl bg-gray-100 p-1">
                <button
                    type="button"
                    onClick={() => { setRoleMode('user'); setShowOTP(false); setOtp(''); resetAdminChangeForm(); }}
                    className={`rounded-lg px-2 py-2 text-xs font-bold transition ${roleMode === 'user' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                >
                    User Login
                </button>
                <button
                    type="button"
                    onClick={() => { setRoleMode('admin'); setShowOTP(false); setOtp(''); resetAdminChangeForm(); }}
                    className={`rounded-lg px-2 py-2 text-xs font-bold transition ${roleMode === 'admin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                >
                    Admin Login
                </button>
                <button
                    type="button"
                    onClick={() => { setRoleMode('change-admin'); setShowOTP(false); setOtp(''); resetAdminChangeForm(); }}
                    className={`rounded-lg px-2 py-2 text-xs font-bold transition ${roleMode === 'change-admin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                >
                    Change Admin
                </button>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-center shadow-inner border border-red-100">{error}</div>}

            {roleMode === 'change-admin' ? (
                <form onSubmit={handleAdminChange} className="space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Current Admin Email</label>
                        <input
                            type="email"
                            required
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 transition shadow-sm"
                            value={adminCurrentEmail}
                            onChange={(e) => setAdminCurrentEmail(e.target.value)}
                            disabled={adminChangeStep === 'otp'}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Current Admin Password</label>
                        <input
                            type="password"
                            required
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 transition shadow-sm"
                            value={adminCurrentPassword}
                            onChange={(e) => setAdminCurrentPassword(e.target.value)}
                            disabled={adminChangeStep === 'otp'}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">New Admin Email</label>
                        <input
                            type="email"
                            required
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 transition shadow-sm"
                            value={adminNewEmail}
                            onChange={(e) => setAdminNewEmail(e.target.value)}
                            disabled={adminChangeStep === 'otp'}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">New Admin Password</label>
                        <input
                            type="password"
                            required
                            minLength="6"
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 transition shadow-sm"
                            value={adminNewPassword}
                            onChange={(e) => setAdminNewPassword(e.target.value)}
                            disabled={adminChangeStep === 'otp'}
                        />
                    </div>

                    {adminChangeStep === 'otp' && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Verification Code (OTP)</label>
                            <input
                                type="text"
                                required
                                placeholder="6-digit code"
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 transition shadow-sm font-bold tracking-widest text-center text-lg"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                maxLength="6"
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-black focus:ring-4 focus:ring-gray-200 transition shadow-md"
                    >
                        {loading ? 'Processing...' : (adminChangeStep === 'otp' ? 'Verify OTP & Update Admin' : 'Send Admin OTP')}
                    </button>
                </form>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    {!showOTP ? (
                        <>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 focus:border-gray-700 transition shadow-sm"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 focus:border-gray-700 transition shadow-sm"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </>
                    ) : (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Verification Code (OTP)</label>
                            <input
                                type="text"
                                required
                                placeholder="6-digit code"
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 transition shadow-sm font-bold tracking-widest text-center text-lg"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                maxLength="6"
                            />
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-black focus:ring-4 focus:ring-gray-200 transition shadow-md"
                    >
                        {loading ? 'Processing...' : (showOTP ? 'Verify OTP & Log In' : 'Sign In')}
                    </button>
                </form>
            )}

            <p className="text-center mt-8 text-gray-600">
                Don&apos;t have an account? <Link to="/register" className="text-gray-900 font-bold hover:underline">Sign up</Link>
            </p>
        </div>
    );
};

export default Login;
