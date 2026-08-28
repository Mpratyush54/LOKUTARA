module.exports = function getRouteLabel(req) {
    if (req.route && req.route.path) {
        if (req.baseUrl) return req.baseUrl + req.route.path;
        return req.route.path;
    }

    if (req.baseUrl) return req.baseUrl;

    return "/unknown";
};
