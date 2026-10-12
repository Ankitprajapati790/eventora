const DEFAULT_EVENT_IMAGE = 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80';

const resolveEventImage = (image) => {
    const cleanValue = typeof image === 'string' ? image.trim() : '';
    return cleanValue || DEFAULT_EVENT_IMAGE;
};

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getAdminCredentialHint = () => null;

module.exports = {
    DEFAULT_EVENT_IMAGE,
    escapeRegex,
    resolveEventImage,
    getAdminCredentialHint
};
