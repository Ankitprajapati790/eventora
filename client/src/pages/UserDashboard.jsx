import { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/axios';
import { Link, useNavigate } from 'react-router-dom';
import { FaTicketAlt, FaTimesCircle } from 'react-icons/fa';

const UserDashboard = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchBookings = useCallback(async () => {
        try {
            const { data } = await api.get('/bookings/my');
            setBookings(data);
        } catch (error) {
            console.error('Error fetching bookings', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        fetchBookings();
        const interval = setInterval(fetchBookings, 1000);
        return () => clearInterval(interval);
    }, [user, navigate, fetchBookings]);

    const stats = useMemo(() => {
        const totalBookings = bookings.length;
        const approvedBookings = bookings.filter(booking => booking.status === 'confirmed').length;
        const pendingBookings = bookings.filter(booking => booking.status === 'pending').length;
        const cancelledBookings = bookings.filter(booking => booking.status === 'cancelled').length;
        const totalSpent = bookings.reduce((sum, booking) => {
            const isPaidConfirmed = booking.status === 'confirmed' && booking.paymentStatus === 'paid';
            return isPaidConfirmed ? sum + Number(booking.amount || 0) : sum;
        }, 0);

        return { totalBookings, approvedBookings, pendingBookings, cancelledBookings, totalSpent };
    }, [bookings]);

    const cancelBooking = async (id) => {
        const reason = window.prompt('Please enter a cancellation reason (optional):', 'No longer available on that date.');
        if (reason === null) return;

        try {
            const { data } = await api.delete(`/bookings/${id}`, { data: { reason: reason.trim() || 'No reason provided' } });
            if (data.emailWarning) alert(data.emailWarning);
            fetchBookings();
        } catch (error) {
            const { message, emailProviderMessage } = error.response?.data || {};
            alert([message, emailProviderMessage].filter(Boolean).join(' ') || 'Error cancelling booking');
        }
    };

    if (loading) return <div className="text-center py-20 text-xl font-semibold">Loading dashboard...</div>;

    return (
        <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 mb-8 border border-gray-100 flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-6">
                <div className="w-20 h-20 bg-gray-200 text-gray-900 rounded-full flex items-center justify-center text-3xl font-bold uppercase tracking-widest shrink-0">
                    {user?.name.charAt(0)}
                </div>
                <div className="flex flex-col items-center sm:items-start">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">Welcome, {user?.name}!</h1>
                    <p className="text-gray-500 flex items-center justify-center sm:justify-start gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span> User Dashboard
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total Bookings</p>
                    <h3 className="text-2xl font-black text-gray-900">{stats.totalBookings}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Approved</p>
                    <h3 className="text-2xl font-black text-emerald-600">{stats.approvedBookings}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Pending</p>
                    <h3 className="text-2xl font-black text-yellow-600">{stats.pendingBookings}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Cancelled</p>
                    <h3 className="text-2xl font-black text-red-600">{stats.cancelledBookings}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total Spent</p>
                    <h3 className="text-2xl font-black text-blue-600">₹{stats.totalSpent}</h3>
                </div>
            </div>

            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3">
                    <FaTicketAlt className="text-gray-700" /> My Bookings requests
                </h2>
            </div>

            {bookings.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FaTicketAlt className="text-gray-300 text-3xl" />
                    </div>
                    <p className="text-xl text-gray-500 mb-6 mt-4 font-medium">You haven&apos;t booked any events yet.</p>
                    <Link to="/" className="inline-block bg-gray-900 hover:bg-black text-white font-bold py-3 px-8 rounded-lg transition shadow-md">
                        Browse Events
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {bookings.map((booking) => (
                        <div key={booking._id} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition border border-gray-100 flex flex-col">
                            <div className="p-6 border-b border-gray-50 flex-grow">
                                {booking.eventId ? (
                                    <>
                                        <div className="flex justify-between items-start mb-4">
                                            <h3 className="text-lg font-bold text-gray-900 leading-tight">{booking.eventId.title}</h3>
                                            <div className="flex flex-col gap-1 items-end">
                                                <span className={`px-2 py-1 text-[10px] font-black rounded uppercase tracking-wider ${booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                                    booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                                        'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                    {booking.status}
                                                </span>
                                                {booking.status !== 'cancelled' && (
                                                    <span className={`px-2 py-1 text-[10px] font-black rounded uppercase tracking-wider ${booking.paymentStatus === 'paid' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                                                        }`}>
                                                        {booking.paymentStatus.replace('_', ' ')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-sm text-gray-500 mb-4 space-y-1">
                                            <p><strong className="text-gray-700">Date:</strong> {new Date(booking.eventId.date).toLocaleDateString()}</p>
                                            <p><strong className="text-gray-700">Amount:</strong> {booking.amount === 0 ? 'Free' : `₹${booking.amount}`}</p>
                                            <p><strong className="text-gray-700">Requested:</strong> {new Date(booking.bookedAt).toLocaleDateString()}</p>
                                            {booking.status === 'cancelled' && booking.cancellationReason && (
                                                <p><strong className="text-gray-700">Reason:</strong> {booking.cancellationReason}</p>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-red-500 italic">Event details unavailable (might have been deleted)</p>
                                )}
                            </div>
                            <div className="p-4 bg-gray-50 flex justify-between items-center shrink-0">
                                {booking.eventId && booking.status !== 'cancelled' ? (
                                    <>
                                        <Link to={`/events/${booking.eventId._id}`} className="text-gray-900 font-semibold text-sm hover:underline">View Event</Link>
                                        <button
                                            onClick={() => cancelBooking(booking._id)}
                                            className="text-red-500 font-semibold text-sm hover:text-red-700 transition flex items-center gap-1"
                                        >
                                            <FaTimesCircle /> Cancel
                                        </button>
                                    </>
                                ) : (
                                    <div className="w-full text-center text-sm text-gray-500 italic">Booking Cancelled</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default UserDashboard;
