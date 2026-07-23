/**
 * Legacy Team panel — superseded by unified Team surface (bookings_blocks / BarbersOverview).
 * Kept as a thin redirect note so old imports do not crash; not mounted from AdminPanel.
 */
export default function TeamAdminPanel() {
  return (
    <section className="surface booking-shell admin-team-section" aria-label="Team">
      <p className="admin-inline-error" role="status">
        Team management moved to the Team tab (formerly Barbers). Use the sidebar item labelled Team.
      </p>
    </section>
  );
}
