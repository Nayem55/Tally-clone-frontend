export function buildReportReturnState(location, focusKey, extraState = {}) {
  const currentTrail = Array.isArray(location?.state?.reportTrail)
    ? location.state.reportTrail
    : [];

  return {
    ...extraState,
    reportTrail: [
      ...currentTrail,
      {
        pathname: location.pathname,
        search: location.search || "",
        focusKey,
      },
    ],
  };
}

export function navigateBackFromReport(navigate, location) {
  const trail = Array.isArray(location?.state?.reportTrail)
    ? location.state.reportTrail
    : [];
  const previous = trail[trail.length - 1];

  if (previous?.pathname) {
    navigate(`${previous.pathname}${previous.search || ""}`, {
      state: {
        restoreFocusKey: previous.focusKey,
        reportTrail: trail.slice(0, -1),
      },
    });
    return true;
  }
  return false;
}
