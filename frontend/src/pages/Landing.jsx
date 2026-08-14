import { Link } from 'react-router-dom'
import './landing.css'

const categories = [
  {
    number: '01',
    title: 'Cameras & Media',
    text: 'Create without buying everything. Find cameras, lenses, tripods, lights, and audio gear around campus.',
    color: 'lavender',
  },
  {
    number: '02',
    title: 'Lab & Study Gear',
    text: 'Access calculators, lab equipment, presentation tools, and study essentials exactly when you need them.',
    color: 'blue',
  },
  {
    number: '03',
    title: 'Sports & Outdoors',
    text: 'Borrow or buy sports kits, training gear, and outdoor equipment from students you can connect with.',
    color: 'yellow',
  },
  {
    number: '04',
    title: 'Electronics & Tools',
    text: 'Keep useful equipment in circulation—from electronics and accessories to workshop and project tools.',
    color: 'peach',
  },
]

const codeLines = [
  'community equipshare::campus {',
  '  // Share more. Spend less.',
  '  public fun list_equipment() {',
  '    owner = current_student;',
  '    access = everyone;',
  '  }',
  '',
  '  // Borrow with confidence.',
  '  public fun request_item() {',
  '    trust = verified;',
  '    status = connected;',
  '  }',
  '}',
]

function Landing() {
  return (
    <div className="landing-page">
      <header className="landing-nav" aria-label="Main navigation">
        <Link to="/" className="landing-brand" aria-label="EquipShare home">
          <span className="landing-brand-mark">E</span>
          <span>EquipShare</span>
        </Link>

        <nav className="landing-links" aria-label="Landing page links">
          <a href="#about">ABOUT <span>⌄</span></a>
          <a href="#categories">CATEGORIES <span>⌄</span></a>
          <a href="#how-it-works">HOW IT WORKS <span>⌄</span></a>
        </nav>

        <Link to="/explore" className="landing-nav-cta">EXPLORE</Link>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-content">
            <p className="landing-eyebrow">THE CAMPUS EQUIPMENT NETWORK</p>
            <h1>Share Equipment<br />&amp; Opportunity</h1>
            <Link to="/explore" className="landing-dark-button">EXPLORE EQUIPMENT</Link>
          </div>

          <div className="landing-code-panel" aria-hidden="true">
            <code>
              {codeLines.map((line, index) => <span key={`${line}-${index}`}>{line || '\u00A0'}</span>)}
            </code>
            <div className="landing-ribbons">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
          </div>
          <p className="landing-scroll-label">SCROLL TO DISCOVER <span>↓</span></p>
        </section>

        <section id="about" className="landing-story">
          <div className="landing-story-kicker">EQUIPSHARE IS THE SIMPLEST WAY TO</div>
          <h2 className="landing-on-dark">Move access,<br />not ownership.</h2>
          <div className="landing-story-copy">
            <p>Good equipment should spend more time being used and less time sitting unused.</p>
            <p>EquipShare connects students who have equipment with students who need it—making college projects, events, sports, and creative work easier to start.</p>
          </div>
        </section>

        <section id="how-it-works" className="landing-performance">
          <div className="landing-stat-block">
            <div className="landing-stat">3</div>
            <p className="landing-stat-name">simple steps</p>
            <p className="landing-stat-caption">LIST. REQUEST. CONNECT.</p>
          </div>
          <div className="landing-performance-copy">
            <p className="landing-on-dark">List equipment in minutes. Discover what is available nearby. Send a secure request and keep every transaction tied to a verified account.</p>
            <Link to="/register" className="landing-light-button">JOIN EQUIPSHARE</Link>
          </div>
          <div className="landing-code-card" aria-hidden="true">
            <span>PUBLIC FUN SHARE() {'{'}</span>
            <span>&nbsp;&nbsp;ITEM.STATUS = AVAILABLE;</span>
            <span>&nbsp;&nbsp;OWNER.ID = CURRENT_USER;</span>
            <span>&nbsp;&nbsp;RETURN CAMPUS_ACCESS;</span>
            <span>{'}'}</span>
          </div>
        </section>

        <section id="categories" className="landing-categories">
          <div className="landing-section-heading">
            <h2>What moves on EquipShare?<br /><em>Just about everything.</em></h2>
            <Link to="/explore" className="landing-outline-button">ALL EQUIPMENT</Link>
          </div>

          <div className="landing-category-grid">
            {categories.map((category) => (
              <Link
                to="/explore"
                className={`landing-category-card landing-category-${category.color}`}
                key={category.title}
              >
                <span className="landing-category-number">{category.number}</span>
                <div>
                  <h3>{category.title}</h3>
                  <p>{category.text}</p>
                </div>
                <span className="landing-category-arrow">↗</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="landing-community">
          <p className="landing-community-label">BUILT FOR EVERY KIND OF CAMPUS PROJECT</p>
          <div className="landing-marquee" aria-label="Equipment categories">
            <span>CAMERAS · CALCULATORS · SPORTS · LAB GEAR · TOOLS · ELECTRONICS · </span>
          </div>
        </section>

        <section className="landing-final-cta">
          <p>REAL EQUIPMENT. REAL STUDENTS. REAL PROJECTS.</p>
          <h2>Find what you need.<br />Share what you have.</h2>
          <div className="landing-final-actions">
            <Link to="/explore" className="landing-dark-button">EXPLORE EQUIPMENT</Link>
            <Link to="/register" className="landing-outline-button">CREATE ACCOUNT</Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <Link to="/" className="landing-brand landing-on-dark">
          <span className="landing-brand-mark landing-brand-mark-light">E</span>
          <span>EquipShare</span>
        </Link>
        <p>Share more. Spend less. Build together.</p>
        <div>
          <Link to="/explore">Explore</Link>
          <Link to="/login">Sign in</Link>
          <Link to="/register">Register</Link>
        </div>
      </footer>
    </div>
  )
}

export default Landing
