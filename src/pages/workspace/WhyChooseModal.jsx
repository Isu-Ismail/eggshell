import { Sparkles, Zap, AlertTriangle, Check } from 'lucide-react';
import styles from './Workspace.module.css';

export default function WhyChooseModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className={styles.whyOverlay} onClick={onClose}>
      <div className={styles.whyModal} onClick={e => e.stopPropagation()}>
        <div className={styles.whyHeader}>
          <div className={styles.whyTitleWrapper}>
            <Sparkles size={20} style={{ color: '#a855f7' }} />
            <h3 className={styles.whyTitle}>Why Choose Melder Over Excel?</h3>
          </div>
          <button className={styles.whyCloseBtn} onClick={onClose} title="Close Showcase">&times;</button>
        </div>
        
        <div className={styles.whyBody}>
          <p className={styles.whyIntro}>
            Melder is a visual data pipeline builder designed for scale, precision, and reuse. Unlike standard spreadsheets that break silently, Melder builds industrial-grade workflows directly in your browser.
          </p>
          
          <div className={styles.comparisonGrid}>
            <div className={styles.comparisonCard}>
              <div className={styles.comparisonHeader}>
                <span className={styles.melderTag}>
                  <Zap size={10} style={{ fill: '#166534' }} /> Melder Way
                </span>
                <h5 className={styles.comparisonTitle}>SQLite Database Engine</h5>
              </div>
              <p className={styles.comparisonText}>Powered by a real SQLite database. Operations are lightning-fast, fully relational, and can handle millions of rows in OPFS without a single crash.</p>
            </div>
            
            <div className={styles.comparisonCard}>
              <div className={styles.comparisonHeader}>
                <span className={styles.excelTag}>
                  <AlertTriangle size={10} style={{ fill: '#991b1b' }} /> Excel Way
                </span>
                <h5 className={styles.comparisonTitle}>Fragile & Heavy Sheets</h5>
              </div>
              <p className={styles.comparisonText}>Standard spreadsheets crash or lag with large rows. Formulas recalculate constantly, causing lag and silent data errors.</p>
            </div>

            <div className={styles.comparisonCard}>
              <div className={styles.comparisonHeader}>
                <span className={styles.melderTag}>
                  <Zap size={10} style={{ fill: '#166534' }} /> Melder Way
                </span>
                <h5 className={styles.comparisonTitle}>Interactive Wiring Mappings</h5>
              </div>
              <p className={styles.comparisonText}>Wire files, joins, transformers, and conditions visually on an interactive canvas. You can trace your data logic step-by-step.</p>
            </div>

            <div className={styles.comparisonCard}>
              <div className={styles.comparisonHeader}>
                <span className={styles.excelTag}>
                  <AlertTriangle size={10} style={{ fill: '#991b1b' }} /> Excel Way
                </span>
                <h5 className={styles.comparisonTitle}>Messy & Hidden Formulas</h5>
              </div>
              <p className={styles.comparisonText}>Formulas are buried inside thousands of individual cells. Mismatched sorting requires tedious manual search and fixes.</p>
            </div>

            <div className={styles.comparisonCard}>
              <div className={styles.comparisonHeader}>
                <span className={styles.melderTag}>
                  <Zap size={10} style={{ fill: '#166534' }} /> Melder Way
                </span>
                <h5 className={styles.comparisonTitle}>100% Client-Side Privacy</h5>
              </div>
              <p className={styles.comparisonText}>Processed completely in your local browser client. No file is ever uploaded to a server, guaranteeing absolute data privacy, 0 server lag, and zero subscription costs!</p>
            </div>
            
            <div className={styles.comparisonCard}>
              <div className={styles.comparisonHeader}>
                <span className={styles.excelTag}>
                  <AlertTriangle size={10} style={{ fill: '#991b1b' }} /> Excel Way
                </span>
                <h5 className={styles.comparisonTitle}>Server Syncing & Subscriptions</h5>
              </div>
              <p className={styles.comparisonText}>Requires heavy, recurring subscription payments, cloud connections, and uploading sensitive enterprise spreadsheets to external servers.</p>
            </div>

            <div className={styles.comparisonCard}>
              <div className={styles.comparisonHeader}>
                <span className={styles.melderTag}>
                  <Zap size={10} style={{ fill: '#166534' }} /> Melder Way
                </span>
                <h5 className={styles.comparisonTitle}>On-The-Go Compilation</h5>
              </div>
              <p className={styles.comparisonText}>Filters, transforms, and conditional rules compile dynamically on the go. Any update recalculates instantly and shows up in the stitched table immediately.</p>
            </div>

            <div className={styles.comparisonCard}>
              <div className={styles.comparisonHeader}>
                <span className={styles.excelTag}>
                  <AlertTriangle size={10} style={{ fill: '#991b1b' }} /> Excel Way
                </span>
                <h5 className={styles.comparisonTitle}>Slow Manual Recalculation</h5>
              </div>
              <p className={styles.comparisonText}>Heavy sheets require pausing automatic updates to avoid crashing. Activating them requires hitting manually triggered update calculations.</p>
            </div>

            <div className={styles.comparisonCard}>
              <div className={styles.comparisonHeader}>
                <span className={styles.melderTag}>
                  <Zap size={10} style={{ fill: '#166534' }} /> Melder Way
                </span>
                <h5 className={styles.comparisonTitle}>Cross-Sheet Global Logic</h5>
              </div>
              <p className={styles.comparisonText}>Run complex conditional logic and row filters across all joined datasets at once. Rules evaluate globally across all sheet boundaries effortlessly.</p>
            </div>

            <div className={styles.comparisonCard}>
              <div className={styles.comparisonHeader}>
                <span className={styles.excelTag}>
                  <AlertTriangle size={10} style={{ fill: '#991b1b' }} /> Excel Way
                </span>
                <h5 className={styles.comparisonTitle}>Brittle Cross-File Linking</h5>
              </div>
              <p className={styles.comparisonText}>Referencing columns in separate Excel files creates deep, rigid, and fragile link paths. Moving or renaming any file instantly breaks the entire sheet.</p>
            </div>

            <div className={styles.comparisonCard}>
              <div className={styles.comparisonHeader}>
                <span className={styles.melderTag}>
                  <Zap size={10} style={{ fill: '#166534' }} /> Melder Way
                </span>
                <h5 className={styles.comparisonTitle}>AI-Assisted Auto Scripting</h5>
              </div>
              <p className={styles.comparisonText}>Export all sheet headers and pipeline schemas with one click. Paste them into ChatGPT, Claude, or Gemini to instantly generate perfect JSON automation configs and complex SQLite expressions!</p>
            </div>

            <div className={styles.comparisonCard}>
              <div className={styles.comparisonHeader}>
                <span className={styles.excelTag}>
                  <AlertTriangle size={10} style={{ fill: '#991b1b' }} /> Excel Way
                </span>
                <h5 className={styles.comparisonTitle}>Manual Formula Hunting</h5>
              </div>
              <p className={styles.comparisonText}>Search forums or web tutorials, trying to correctly nest complex combinations of VLOOKUP, IF, AND, and text functions to build basic logic.</p>
            </div>

            <div className={styles.comparisonCard}>
              <div className={styles.comparisonHeader}>
                <span className={styles.melderTag}>
                  <Zap size={10} style={{ fill: '#166534' }} /> Melder Way
                </span>
                <h5 className={styles.comparisonTitle}>One-Click Automation</h5>
              </div>
              <p className={styles.comparisonText}>Save your entire visual pipeline config as a tiny JSON file. Whenever you receive new weekly reports, load the config and stitch it instantly!</p>
            </div>

            <div className={styles.comparisonCard}>
              <div className={styles.comparisonHeader}>
                <span className={styles.excelTag}>
                  <AlertTriangle size={10} style={{ fill: '#991b1b' }} /> Excel Way
                </span>
                <h5 className={styles.comparisonTitle}>Manual Repeating Work</h5>
              </div>
              <p className={styles.comparisonText}>Every time you get new sheets, you have to repeat the same manual VLOOKUPs, filters, and copy-paste steps from scratch.</p>
            </div>
          </div>
        </div>
        
        <div className={styles.whyFooter}>
          <button className={styles.whyActionBtn} onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            Got it, let's stitch! <Check size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
