/**
 * Icon Assets Index
 * 
 * All custom Mindlock icons with neon outline style.
 * Use with AppIcon component for consistent sizing.
 */

// Navigation Icons
export const DashboardNavIcon = require('./DashboardNav.png');
export const LeaderboardNavIcon = require('./LeaderboardNav.png');
export const BrainQuizNavIcon = require('./BrainQuizNav.png');
export const SettingsGearIcon = require('./SettingsGear.png');

// Tier Badges
export const DiamondSageIcon = require('./DiamondSage.png');
export const EmeraldScholarIcon = require('./EmeraldScholar.png');
export const SteelDisciplineIcon = require('./SteelDiscipline.png');

// Shield Icons
export const WardenShieldIcon = require('./WardenShield.png');
export const DayPassShieldIcon = require('./DayPassShield.png');

// Token & Karma
export const SeekerTokenIcon = require('./SeekerToken.png');
export const KarmaBoostIcon = require('./KarmaBoost.png');
export const LightningBoltIcon = require('./LightningBolt.png');
export const ScholarshipIcon = require('./Scholarship.png');

// Streak Icons
export const StreakFireIcon = require('./StreakFire.png');
export const StreakIceIcon = require('./StreakIce.png');

// Action Icons
export const GiftBoxClaimIcon = require('./GiftBoxClaim.png');
export const HeartCharityIcon = require('./HeartCharity.png');
export const WalletConnectIcon = require('./WalletConnect.png');
export const CheckVerifiedIcon = require('./CheckVerified.png');
export const TimerClockIcon = require('./TimerClock.png');
export const MerkleTreeIcon = require('./MerkleTree.png');

// Icon name to source mapping for dynamic usage
export const IconMap = {
    // Navigation
    dashboard: DashboardNavIcon,
    leaderboard: LeaderboardNavIcon,
    quiz: BrainQuizNavIcon,
    settings: SettingsGearIcon,

    // Tiers
    diamond: DiamondSageIcon,
    emerald: EmeraldScholarIcon,
    steel: SteelDisciplineIcon,

    // Shields
    warden: WardenShieldIcon,
    daypass: DayPassShieldIcon,
    shield: WardenShieldIcon,

    // Token/Karma
    token: SeekerTokenIcon,
    skr: SeekerTokenIcon,
    karma: KarmaBoostIcon,
    boost: LightningBoltIcon,
    scholarship: ScholarshipIcon,

    // Streak
    fire: StreakFireIcon,
    ice: StreakIceIcon,
    streak: StreakFireIcon,
    frozen: StreakIceIcon,

    // Actions
    claim: GiftBoxClaimIcon,
    gift: GiftBoxClaimIcon,
    charity: HeartCharityIcon,
    heart: HeartCharityIcon,
    wallet: WalletConnectIcon,
    verified: CheckVerifiedIcon,
    timer: TimerClockIcon,
    merkle: MerkleTreeIcon,
} as const;

export type IconName = keyof typeof IconMap;
