import { X, BookOpen, Sparkles, Filter, Link2, ListChecks, Zap, BrainCircuit } from 'lucide-react';
import styles from './Workspace.module.css';

export default function TutorialDrawer({ isOpen, onClose }) {
  return (
    <div className={`${styles.drawer} ${isOpen ? styles.drawerOpen : ''}`}>
      <div className={styles.drawerHeader}>
        <div className={styles.drawerTitleWrapper}>
          <BookOpen size={16} />
          <h3>How-To & Guides</h3>
        </div>
        <button className={styles.drawerCloseBtn} onClick={onClose} title="Close Guides">
          <X size={18} />
        </button>
      </div>
      <div className={styles.drawerBody}>
        <section className={styles.drawerSection}>
          <div className={styles.sectionHeader}>
            <Sparkles size={14} style={{ color: '#a855f7' }} />
            <h4>1. Text Standardizing (Transform Block)</h4>
          </div>
          <p>Standardize capitalization or format text cells to prevent spelling misalignments:</p>
          <p>• <strong>UPPERCASE / lowercase</strong>: Instantly forces all text to UPPERCASE (e.g. <code>ALICE</code>) or lowercase (e.g. <code>alice</code>).</p>
          <p>• <strong>TRIM</strong>: Removes leading and trailing blank spaces automatically (e.g. <code>" Alice "</code> to <code>"Alice"</code>).</p>
          <p>• <strong>Custom Scripts</strong>: Run native SQLite functions on text! Write expressions like <code>{`{col} || ' (active)'`}</code> to append labels dynamically.</p>
        </section>

        <section className={styles.drawerSection}>
          <div className={styles.sectionHeader}>
            <Filter size={14} style={{ color: '#ec4899' }} />
            <h4>2. Database Rows Filter (Filter Block)</h4>
          </div>
          <p>Selectively keep or drop database records matching your custom criteria:</p>
          <p>• <strong>Write Conditions</strong>: Input any SQLite <code>WHERE</code> clause. Reference the active column using <code>{`{col}`}</code>.</p>
          <p>• <strong>Examples</strong>: <code>{`{col} = 'value'`}</code> or <code>{`{col} > 100`}</code> or <code>{`{col} LIKE '%paid%'`}</code>.</p>
          <p>• <strong>Effect</strong>: Rows that evaluate to false/null will be filtered out, keeping your final stitched dataset absolutely clean.</p>
        </section>

        <section className={styles.drawerSection}>
          <div className={styles.sectionHeader}>
            <Link2 size={14} style={{ color: '#06b6d4' }} />
            <h4>3. Mismatch Resolution (Join Block)</h4>
          </div>
          <p>Map two sheets on a shared key (e.g. Student ID) to combine their columns:</p>
          <p>• <strong>Yellow (Base) Handle</strong>: Connect the primary key from your primary sheet.</p>
          <p>• <strong>Purple (Match) Handle</strong>: Connect the corresponding key from your secondary sheet.</p>
          <p>• <strong>Action</strong>: The engine performs a fast <code>LEFT JOIN</code>. Surrounding spaces are trimmed and strings are compared case-insensitively, so mapping never fails due to minor spelling variances.</p>
        </section>

        <section className={styles.drawerSection}>
          <div className={styles.sectionHeader}>
            <ListChecks size={14} style={{ color: '#10b981' }} />
            <h4>4. Advanced If-Else Mapping (Conditional Block)</h4>
          </div>
          <p>Evaluate multiple comparison rules to calculate and write dynamic column values:</p>
          <p>• <strong>New Column Header</strong>: Specify the name of the column to append (e.g. <code>amount</code> or <code>weight_class</code>).</p>
          <p>• <strong>Rule Builder</strong>: Click the Eye button to open the inspector. Add multi-level <code>IF-ELSE</code> rules stack with math or string operators (e.g. <code>IF {`{col}`}  60 THEN 'overweight'</code>).</p>
          <p>• <strong>Downstream Sync</strong>: As you type your new column name, the **connected output card column header renames itself in real-time**!</p>
        </section>

        <section className={styles.drawerSection}>
          <div className={styles.sectionHeader}>
            <Zap size={14} style={{ color: '#eab308' }} />
            <h4>Click-to-Route Wires 🔌</h4>
          </div>
          <p>1. <strong>Single-click</strong> a handle to start drawing a line. You don't need to hold the mouse down!</p>
          <p>2. Move your cursor. A dashed grey wire will follow your mouse dynamically.</p>
          <p>3. <strong>Single-click anywhere on the canvas</strong> to drop a <strong>Corner Joint (Route Point)</strong>! The line will bend exactly around this point.</p>
          <p>4. <strong>Single-click a target handle</strong> to finish the wire cleanly!</p>
          <p>5. <strong>Double-click</strong> anywhere to cancel drawing.</p>
        </section>

        <section className={styles.drawerSection}>
          <div className={styles.sectionHeader}>
            <BrainCircuit size={14} style={{ color: '#a855f7' }} />
            <h4>AI-Assisted Auto Scripting 🤖</h4>
          </div>
          <p>Easily feed your pipeline schema to your favorite AI (ChatGPT, Claude, Gemini) to generate custom configurations without writing code:</p>
          <p>1. Click the purple **"AI Scripting"** button in the sidebar.</p>
          <p>2. Select **"Copy Workspace Context"**. This copies all active file schemas, column headers, and active canvas state directly to your clipboard.</p>
          <p>3. Paste this context into your AI Chatbot along with your instructions (e.g. <code>"Standardize the name column, filter for sales above 100, and join with users on ID"</code>).</p>
          <p>4. Copy the JSON config or SQLite script generated by the AI, paste it into Melder's scripting console, and apply it instantly!</p>
        </section>
      </div>
    </div>
  );
}
