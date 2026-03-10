import { cn } from '@/lib/utils';

interface Feature261Props {
  className?: string;
}

const Feature261 = ({ className }: Feature261Props) => {
  return (
    <section className={cn('feature261', className)} aria-labelledby="feature261-title">
      <div className="container">
                <header className="feature261__header">
          <h2 id="feature261-title">Everything your barbershop needs in one system</h2>
          <p>
            From bookings and schedules to retail, contact requests and easy updates — every key
            part of the shop runs through one clean website system.
          </p>
        </header>


        <div className="feature261__grid">
          <article className="feature261__card feature261__card--booking-flow">
            <div className="feature261__content">
              <h3>Client booking flow</h3>
              <p>
                Let clients choose a service, pick a slot and move through a cleaner booking
                experience without back-and-forth messages.
              </p>
            </div>
            <div className="feature261__screen" aria-hidden="true">
              <div className="feature261__screen-head">
                <span>book.kersivo</span>
                <i />
              </div>
              <div className="feature261__screen-body">
                <div className="feature261__screen-chip">Skin Fade + Beard Trim</div>
                <div className="feature261__screen-grid">
                  <span>10:30</span>
                  <span>11:00</span>
                  <span>11:30</span>
                  <span className="is-active">12:00</span>
                  <span>12:30</span>
                  <span>13:00</span>
                </div>
                <button type="button">Continue booking</button>
              </div>
            </div>
          </article>

          <article className="feature261__card feature261__card--bookings-dashboard">
            <div className="feature261__content">
              <h3>Bookings dashboard</h3>
              <p>
                Keep appointments, daily availability and the team’s flow visible from one clear
                admin layer.
              </p>
            </div>
            <div className="feature261__screen" aria-hidden="true">
              <div className="feature261__screen-head">
                <span>admin / bookings</span>
                <i />
              </div>
              <ul className="feature261__timeline">
                <li>
                  <b>09:30</b>
                  <span>Jordan · Classic Cut</span>
                  <em>Confirmed</em>
                </li>
                <li>
                  <b>10:15</b>
                  <span>Marcus · Skin Fade + Beard</span>
                  <em>Confirmed</em>
                </li>
                <li>
                  <b>11:00</b>
                  <span>Levi · Premium Grooming</span>
                  <em>Pending</em>
                </li>
                <li>
                  <b>12:30</b>
                  <span>Jordan · Student Cut</span>
                  <em>Confirmed</em>
                </li>
                <li>
                  <b>13:15</b>
                  <span>Marcus · Beard Sculpt</span>
                  <em>Rescheduled</em>
                </li>
              </ul>
            </div>
          </article>

          <article className="feature261__card feature261__card--contact">
            <div className="feature261__content">
              <h3>Contact requests</h3>
              <p>Receive service enquiries by email through one clear contact flow.</p>
            </div>
            <div className="feature261__mini" aria-hidden="true">
              <span>subject</span>
              <strong>Service request: wedding package</strong>
            </div>
          </article>

          <article className="feature261__card feature261__card--easy-admin">
            <div className="feature261__content">
              <h3>Easy admin</h3>
              <p>Update services, products and key content without touching code.</p>
            </div>
            <div className="feature261__list" aria-hidden="true">
              <span>Services</span>
              <span>Products</span>
              <span>Homepage copy</span>
            </div>
          </article>

          <article className="feature261__card feature261__card--shop-pickup">
            <div className="feature261__content">
              <h3>Shop &amp; pickup</h3>
              <p>
                Sell products online and prepare pickup-ready orders inside the same connected
                system.
              </p>
            </div>
            <div className="feature261__screen" aria-hidden="true">
              <div className="feature261__screen-head">
                <span>admin / shop orders</span>
                <i />
              </div>
              <div className="feature261__orders">
                <div>
                  <strong>#249</strong>
                  <span>Matte Pomade + Styling Comb</span>
                  <em>Ready for pickup</em>
                </div>
                <div>
                  <strong>#251</strong>
                  <span>Sea Salt Spray</span>
                  <em>Packing</em>
                </div>
                <div>
                  <strong>#252</strong>
                  <span>Beard Oil + Brush</span>
                  <em>Paid</em>
                </div>
              </div>
            </div>
          </article>

          <article className="feature261__card feature261__card--schedules">
            <div className="feature261__content">
              <h3>Barber schedules</h3>
              <p>Keep service availability and team flow clear across the week.</p>
            </div>
            <div className="feature261__schedule" aria-hidden="true">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
            </div>
          </article>

          <article className="feature261__card feature261__card--premium-site">
            <div className="feature261__content">
              <h3>Premium website experience</h3>
              <p>
                Give your barbershop a cleaner, stronger online presence built around your brand.
              </p>
            </div>
            <div className="feature261__site-preview" aria-hidden="true">
              <p>KERSIVO BARBER</p>
              <small>Book • Shop • Contact</small>
            </div>
          </article>

          <article className="feature261__card feature261__card--retail">
            <div className="feature261__content">
              <h3>Retail built in</h3>
              <p>Curated products and pickup-ready retail live inside the same website system.</p>
            </div>
            <img
              src="/uploads/products/6c82fe46-5695-424e-abbf-868296192165.png"
              alt="Retail product presentation"
              className="feature261__retail-image"
            />
\
          </article>
        </div>
      </div>
    </section>
  );
};

export { Feature261 };
