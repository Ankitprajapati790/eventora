import { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/axios';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [events, setEvents] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showEventForm, setShowEventForm] = useState(false);
    const [editingEventId, setEditingEventId] = useState(null);
    const [rejectModal, setRejectModal] = useState({ open: false, bookingId: null, reason: '' });
    const [successModal, setSuccessModal] = useState({ open: false, title: '', message: '' });
    const [processingBookingId, setProcessingBookingId] = useState(null);
    const [processingAction, setProcessingAction] = useState('');
    const [formData, setFormData] = useState({
        title: '', description: '', date: '', time: '09:00', location: '', category: '', totalSeats: '', ticketPrice: '', image: ''
    });

    const fetchData = useCallback(async () => {
        try {
            const [eventsRes, bookingsRes] = await Promise.all([
                api.get('/events'),
                api.get('/bookings/my') // Admin gets all bookings
            ]);
            setEvents(eventsRes.data);
            setBookings(bookingsRes.data);
        } catch (error) {
            console.error('Error fetching admin data', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!user || user.role !== 'admin') {
            navigate('/login');
            return;
        }
        fetchData();
        const interval = setInterval(fetchData, 1000);
        return () => clearInterval(interval);
    }, [user, navigate, fetchData]);

    const stats = useMemo(() => {
        const totalRevenue = bookings.reduce((sum, booking) => {
            const isConfirmedSale = booking.status === 'confirmed' && booking.paymentStatus === 'paid';
            return isConfirmedSale ? sum + Number(booking.amount || 0) : sum;
        }, 0);

        const paidClients = new Set(
            bookings
                .filter(booking => booking.status === 'confirmed' && booking.paymentStatus === 'paid')
                .map(booking => booking.userId?._id)
                .filter(Boolean)
        ).size;

        const pendingRequests = bookings.filter(booking => booking.status === 'pending').length;
        const approvedBookings = bookings.filter(booking => booking.status === 'confirmed').length;
        const undecidedBookings = bookings.filter(booking => booking.status === 'pending').length;
        const rejectedBookings = bookings.filter(booking => booking.status === 'cancelled').length;

        return {
            totalRevenue,
            paidClients,
            pendingRequests,
            approvedBookings,
            undecidedBookings,
            rejectedBookings,
            totalEvents: events.length
        };
    }, [bookings, events]);

    const resetEventForm = () => {
        setShowEventForm(false);
        setEditingEventId(null);
        setFormData({ title: '', description: '', date: '', time: '09:00', location: '', category: '', totalSeats: '', ticketPrice: '', image: '' });
    };

    const handleCreateEvent = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                image: formData.image?.trim() || 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80',
                time: formData.time || '09:00'
            };

            if (editingEventId) {
                await api.put(`/events/${editingEventId}`, payload);
                setSuccessModal({
                    open: true,
                    title: 'Event updated successfully',
                    message: `The event "${payload.title}" was updated successfully and is now live.`
                });
            } else {
                await api.post('/events', payload);
                setSuccessModal({
                    open: true,
                    title: 'Event created successfully',
                    message: `The event "${payload.title}" was created successfully and is now available to users.`
                });
            }
            resetEventForm();
            await fetchData();
        } catch (error) {
            alert(error.response?.data?.message || 'Error saving event');
        }
    };

    const handleEditEvent = (event) => {
        setEditingEventId(event._id);
        setFormData({
            title: event.title,
            description: event.description,
            date: new Date(event.date).toISOString().split('T')[0],
            time: event.time || '09:00',
            location: event.location,
            category: event.category,
            totalSeats: event.totalSeats,
            ticketPrice: event.ticketPrice,
            image: event.image || ''
        });
        setShowEventForm(true);
    };

    const handleDeleteEvent = async (id) => {
        if (window.confirm('Are you sure you want to delete this event?')) {
            try {
                const eventToDelete = events.find(event => event._id === id);
                await api.delete(`/events/${id}`);
                setSuccessModal({
                    open: true,
                    title: 'Event deleted successfully',
                    message: `The event "${eventToDelete?.title || 'selected event'}" was deleted successfully.`
                });
                await fetchData();
            } catch (error) {
                alert('Error deleting event');
            }
        }
    };

    const handleConfirmBooking = async (booking, paymentStatus) => {
        if (processingBookingId === booking._id) return;

        setProcessingBookingId(booking._id);
        setProcessingAction('approve');

        try {
            const { data } = await api.put(`/bookings/${booking._id}/confirm`, { paymentStatus });
            const userName = booking.userId?.name || 'User';
            const userEmail = booking.userId?.email || 'email not available';
            const eventTitle = booking.eventId?.title || 'Event';
            const paymentLabel = paymentStatus === 'paid' ? 'paid' : 'undecided';

            setBookings(current => current.map(item =>
                item._id === booking._id
                    ? { ...item, status: 'confirmed', paymentStatus, amount: Number(item.amount || 0) }
                    : item
            ));

            setSuccessModal({
                open: true,
                title: `Booking approved for ${userName}`,
                message: `The booking for ${eventTitle} has been approved for ${userName} (${userEmail}). ${data.emailWarning || 'The booking confirmation email was sent successfully.'} Payment status: ${paymentLabel}.`
            });
            await fetchData();
        } catch (error) {
            alert(error.response?.data?.message || 'Error confirming booking');
        } finally {
            setProcessingBookingId(null);
            setProcessingAction('');
        }
    };

    const handleCancelBooking = async () => {
        if (!rejectModal.bookingId) return;

        const reason = rejectModal.reason.trim();
        if (!reason) {
            alert('Please provide a reason for rejecting this booking.');
            return;
        }

        setProcessingBookingId(rejectModal.bookingId);
        setProcessingAction('reject');

        try {
            const booking = bookings.find(b => b._id === rejectModal.bookingId);
            const { data } = await api.delete(`/bookings/${rejectModal.bookingId}`, { data: { reason } });
            const userName = booking?.userId?.name || 'User';
            const userEmail = booking?.userId?.email || 'email not available';
            const eventTitle = booking?.eventId?.title || 'Event';

            setBookings(current => current.map(item =>
                item._id === rejectModal.bookingId
                    ? { ...item, status: 'cancelled', cancellationReason: reason }
                    : item
            ));

            setRejectModal({ open: false, bookingId: null, reason: '' });
            setSuccessModal({
                open: true,
                title: `Booking rejected for ${userName}`,
                message: `The booking for ${eventTitle} was rejected for ${userName} (${userEmail}). ${data.emailWarning || 'A rejection email with the reason was sent successfully.'}`
            });
            await fetchData();
        } catch (error) {
            alert(error.response?.data?.message || 'Error cancelling booking');
        } finally {
            setProcessingBookingId(null);
            setProcessingAction('');
        }
    };

    const bookingGroups = {
        undecided: bookings.filter(b => b.status === 'pending'),
        approved: bookings.filter(b => b.status === 'confirmed'),
        rejected: bookings.filter(b => b.status === 'cancelled')
    };

    const renderBookingCard = (booking) => {
        const resolvedPaymentStatus = booking.paymentStatus === 'paid' ? 'paid' : 'not paid';

        return (
        <li key={booking._id} className={`p-6 hover:bg-gray-50 transition border-l-4 ${booking.status === 'pending' ? 'border-l-yellow-400' : booking.status === 'confirmed' ? 'border-l-green-400' : 'border-l-red-400'}`}>
            <div className="flex justify-between items-start mb-3">
                <h4 className="font-bold text-gray-900 text-lg leading-tight">{booking.eventId?.title || 'Deleted Event'}</h4>
                <div className="flex flex-col gap-1 items-end shrink-0 ml-4">
                    <span className={`px-2 py-1 text-[10px] font-black rounded uppercase tracking-wider ${booking.status === 'confirmed' ? 'bg-green-100 text-green-700' : booking.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{booking.status}</span>
                    {booking.status !== 'cancelled' && <span className={`px-2 py-1 text-[10px] font-black rounded uppercase tracking-wider ${resolvedPaymentStatus === 'paid' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-800'}`}>{resolvedPaymentStatus}</span>}
                </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-100 text-sm">
                <p className="text-gray-700 flex items-center gap-2 mb-1">
                    <span className="font-bold w-16 text-gray-500 uppercase text-xs">User:</span>
                    <span className="font-semibold">{booking.userId?.name}</span>
                    <span className="text-gray-400">({booking.userId?.email})</span>
                </p>
                <p className="text-gray-700 flex items-center gap-2 mb-1">
                    <span className="font-bold w-16 text-gray-500 uppercase text-xs">Amount:</span>
                    <span className={`font-semibold ${booking.amount === 0 ? 'text-green-600' : ''}`}>{booking.amount === 0 ? 'Free' : `₹${booking.amount}`}</span>
                </p>
                <p className="text-gray-700 flex items-center gap-2 mb-1">
                    <span className="font-bold w-16 text-gray-500 uppercase text-xs">Date:</span>
                    <span>{new Date(booking.bookedAt).toLocaleString()}</span>
                </p>
                {booking.status === 'cancelled' && booking.cancellationReason && (
                    <p className="text-gray-700 flex items-center gap-2 mb-1">
                        <span className="font-bold w-16 text-gray-500 uppercase text-xs">Reason:</span>
                        <span>{booking.cancellationReason}</span>
                    </p>
                )}
                {booking.eventId && (
                    <p className="text-gray-700 flex items-center gap-2 mt-2 pt-2 border-t border-gray-200">
                        <span className="font-bold w-16 text-gray-500 uppercase text-xs">Seats:</span>
                        <span className={`font-bold ${booking.eventId.availableSeats > 0 ? 'text-green-600' : 'text-red-500'}`}>{booking.eventId.availableSeats}</span> remaining of {booking.eventId.totalSeats}
                    </p>
                )}
            </div>

            {booking.status === 'pending' && (
                <div className="flex flex-wrap gap-2 mt-2">
                    <button
                        onClick={() => handleConfirmBooking(booking, 'paid')}
                        disabled={processingBookingId === booking._id}
                        className={`flex-1 min-w-[120px] border text-xs font-bold py-2.5 px-3 rounded-lg shadow-sm transition ${processingBookingId === booking._id ? 'bg-green-100 text-green-700 border-green-200 cursor-not-allowed opacity-80' : 'bg-green-50 text-green-700 hover:bg-green-600 hover:text-white border-green-200'}`}
                    >
                        {processingBookingId === booking._id && processingAction === 'approve' ? 'Processing...' : '✓ Approve as Paid'}
                    </button>
                    <button
                        onClick={() => handleConfirmBooking(booking, 'not_paid')}
                        disabled={processingBookingId === booking._id}
                        className={`flex-1 min-w-[120px] border text-xs font-bold py-2.5 px-3 rounded-lg shadow-sm transition ${processingBookingId === booking._id ? 'bg-gray-200 text-gray-700 border-gray-300 cursor-not-allowed opacity-80' : 'bg-gray-50 text-gray-700 hover:bg-gray-800 hover:text-white border-gray-200'}`}
                    >
                        {processingBookingId === booking._id && processingAction === 'approve' ? 'Processing...' : '✓ Approve Undecided'}
                    </button>
                    <button
                        onClick={() => setRejectModal({ open: true, bookingId: booking._id, reason: '' })}
                        disabled={processingBookingId === booking._id}
                        className={`w-[80px] border text-xs font-bold py-2.5 px-3 rounded-lg transition ${processingBookingId === booking._id ? 'bg-red-100 text-red-700 border-red-200 cursor-not-allowed opacity-80' : 'bg-red-50 text-red-600 hover:bg-red-500 hover:text-white border-red-200'}`}
                    >
                        {processingBookingId === booking._id && processingAction === 'reject' ? '...' : '✕ Reject'}
                    </button>
                </div>
            )}
        </li>
        );
    };

    if (loading) return <div className="text-center py-20 text-xl font-semibold">Loading admin panel...</div>;

    return (
        <div className="max-w-7xl mx-auto">
            <div className="bg-black text-white rounded-2xl p-6 sm:p-8 mb-8 shadow-lg flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold mb-2">Admin Dashboard</h1>
                    <p className="text-gray-300">Manage events and manually confirm bookings.</p>
                </div>
                <button
                    onClick={() => {
                        if (showEventForm) {
                            resetEventForm();
                        } else {
                            setShowEventForm(true);
                            setEditingEventId(null);
                            setFormData({ title: '', description: '', date: '', time: '09:00', location: '', category: '', totalSeats: '', ticketPrice: '', image: '' });
                        }
                    }}
                    className="w-full md:w-auto bg-white text-black font-bold py-3 px-6 rounded-lg hover:bg-gray-100 transition shadow-md"
                >
                    {showEventForm ? 'Cancel' : '+ Create New Event'}
                </button>
            </div>

            {/* Admin Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 mb-8">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total Events</p>
                        <h3 className="text-2xl font-black text-gray-900">{stats.totalEvents}</h3>
                    </div>
                    <div className="w-11 h-11 bg-gray-100 text-gray-700 rounded-full flex items-center justify-center text-lg font-bold">📅</div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total Revenue</p>
                        <h3 className="text-2xl font-black text-green-600">₹{stats.totalRevenue}</h3>
                    </div>
                    <div className="w-11 h-11 bg-green-100 text-green-500 rounded-full flex items-center justify-center text-lg font-bold">₹</div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Paid Clients</p>
                        <h3 className="text-2xl font-black text-blue-600">{stats.paidClients}</h3>
                    </div>
                    <div className="w-11 h-11 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center text-lg font-bold">👤</div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Pending</p>
                        <h3 className="text-2xl font-black text-yellow-600">{stats.pendingRequests}</h3>
                    </div>
                    <div className="w-11 h-11 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center text-lg font-bold">⏳</div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Approved</p>
                        <h3 className="text-2xl font-black text-emerald-600">{stats.approvedBookings}</h3>
                    </div>
                    <div className="w-11 h-11 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-lg font-bold">✓</div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Rejected</p>
                        <h3 className="text-2xl font-black text-red-600">{stats.rejectedBookings}</h3>
                    </div>
                    <div className="w-11 h-11 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-lg font-bold">✕</div>
                </div>
            </div>

            {showEventForm && (
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mb-8 animation-slideDown">
                    <h2 className="text-2xl font-bold mb-6 text-gray-800">{editingEventId ? 'Edit Event' : 'Create New Event'}</h2>
                    <form onSubmit={handleCreateEvent} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <input required type="text" placeholder="Event Title" className="border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none transition" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                        <input required type="text" placeholder="Category (e.g., Tech, Music)" className="border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none transition" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} />
                        <input required type="date" className="border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none transition" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                        <input required type="time" className="border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none transition" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} />
                        <input required type="text" placeholder="Location" className="border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none transition" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
                        <input required type="number" placeholder="Total Seats" className="border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none transition" value={formData.totalSeats} onChange={e => setFormData({ ...formData, totalSeats: e.target.value })} />
                        <input required type="number" placeholder="Ticket Price (0 for free)" className="border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none transition" value={formData.ticketPrice} onChange={e => setFormData({ ...formData, ticketPrice: e.target.value })} />

                        <div className="md:col-span-2">
                            <input type="text" placeholder="Image URL (Provide any direct link to an image)" className="w-full border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none transition" value={formData.image} onChange={e => setFormData({ ...formData, image: e.target.value })} />
                        </div>

                        <textarea required placeholder="Event Description" className="border px-4 py-3 rounded-lg md:col-span-2 h-32 focus:ring-2 focus:ring-gray-700 outline-none transition" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                        <button type="submit" className="md:col-span-2 bg-gray-900 text-white font-bold py-3 mt-2 rounded-lg hover:bg-black transition shadow-md">{editingEventId ? 'Save Changes' : 'Publish Event'}</button>
                    </form>
                </div>
            )}

            {rejectModal.open && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-gray-500 font-bold">Booking decision</p>
                                <h3 className="text-2xl font-black text-gray-900 mt-2">Reject booking</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setRejectModal({ open: false, bookingId: null, reason: '' })}
                                className="text-gray-500 hover:text-gray-900 text-2xl leading-none"
                                aria-label="Close rejection dialog"
                            >
                                ×
                            </button>
                        </div>

                        <p className="text-sm text-gray-600 mb-4">Please provide a clear reason. This will be sent to the user by email.</p>

                        <textarea
                            rows="5"
                            value={rejectModal.reason}
                            onChange={(e) => setRejectModal((prev) => ({ ...prev, reason: e.target.value }))}
                            placeholder="Example: Your requested seat count exceeds the available capacity for this event."
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-gray-800 outline-none resize-none"
                        />

                        <div className="flex justify-end gap-3 mt-5">
                            <button
                                type="button"
                                onClick={() => setRejectModal({ open: false, bookingId: null, reason: '' })}
                                className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleCancelBooking}
                                disabled={processingBookingId === rejectModal.bookingId}
                                className={`px-4 py-2.5 rounded-lg font-semibold ${processingBookingId === rejectModal.bookingId ? 'bg-red-300 text-white cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-500'}`}
                            >
                                {processingBookingId === rejectModal.bookingId && processingAction === 'reject' ? 'Rejecting...' : 'Reject booking'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {successModal.open && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-green-600 font-bold">Success</p>
                                <h3 className="text-2xl font-black text-gray-900 mt-2">{successModal.title}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSuccessModal({ open: false, title: '', message: '' })}
                                className="text-gray-500 hover:text-gray-900 text-2xl leading-none"
                                aria-label="Close success dialog"
                            >
                                ×
                            </button>
                        </div>
                        <p className="text-gray-700 leading-7">{successModal.message}</p>
                        <div className="flex justify-end mt-5">
                            <button
                                type="button"
                                onClick={() => setSuccessModal({ open: false, title: '', message: '' })}
                                className="px-4 py-2.5 rounded-lg bg-gray-900 text-white font-semibold hover:bg-black"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Events Section */}
                <div className="flex flex-col">
                    <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 text-sm">{events.length}</span>
                        All Events
                    </h2>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <ul className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                            {events.length === 0 ? <li className="p-6 text-gray-500 text-center">No events created yet.</li> :
                                events.map(event => (
                                    <li key={event._id} className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-gray-50 transition border-b border-gray-100 last:border-0">
                                        <div>
                                            <h4 className="font-bold text-gray-900 mb-1 leading-tight">{event.title}</h4>
                                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                                                <span className="flex items-center gap-1 font-medium"><div className="w-2 h-2 rounded-full bg-blue-500"></div> {new Date(event.date).toLocaleDateString()}</span>
                                                <span className="flex items-center gap-1 font-medium"><div className={`w-2 h-2 rounded-full ${event.availableSeats > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div> {event.availableSeats}/{event.totalSeats} seats</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <button onClick={() => handleEditEvent(event)} className="w-full sm:w-auto text-gray-700 hover:text-white hover:bg-gray-800 border border-gray-300 px-4 py-2 rounded-lg text-sm font-bold transition shadow-sm shrink-0">
                                                Edit
                                            </button>
                                            <button onClick={() => handleDeleteEvent(event._id)} className="w-full sm:w-auto text-red-500 hover:text-white hover:bg-red-500 border border-red-200 px-4 py-2 rounded-lg text-sm font-bold transition shadow-sm shrink-0">
                                                Delete
                                            </button>
                                        </div>
                                    </li>
                                ))
                            }
                        </ul>
                    </div>
                </div>

                {/* Bookings Section */}
                <div className="flex flex-col gap-8">
                    <div>
                        <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-3">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 text-sm font-bold">{bookingGroups.undecided.length}</span>
                            Undecided Bookings
                        </h2>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <ul className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
                                {bookingGroups.undecided.length === 0 ? <li className="p-6 text-gray-500 text-center">No undecided bookings.</li> : bookingGroups.undecided.map(booking => renderBookingCard(booking))}
                            </ul>
                        </div>
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-3">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 text-sm font-bold">{bookingGroups.approved.length}</span>
                            Approved Bookings
                        </h2>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <ul className="divide-y divide-gray-100 max-h-[360px] overflow-y-auto">
                                {bookingGroups.approved.length === 0 ? <li className="p-6 text-gray-500 text-center">No approved bookings.</li> : bookingGroups.approved.map(booking => renderBookingCard(booking))}
                            </ul>
                        </div>
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-3">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-700 text-sm font-bold">{bookingGroups.rejected.length}</span>
                            Rejected Bookings
                        </h2>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <ul className="divide-y divide-gray-100 max-h-[360px] overflow-y-auto">
                                {bookingGroups.rejected.length === 0 ? <li className="p-6 text-gray-500 text-center">No rejected bookings.</li> : bookingGroups.rejected.map(booking => renderBookingCard(booking))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
