// Components barrel export
export { FeedbackModal, type FeedbackData } from './FeedbackModal'
export { ContactModal, type ContactMessage } from './ContactModal'
export { CinematicAnalysisLoader } from './CinematicAnalysisLoader'
export { default as DashboardHeader } from './DashboardHeader'
export { default as Navbar } from './Navbar'
export { default as PurchaseLeadButton } from './PurchaseLeadButton'
export { default as SpecialtySelection } from './SpecialtySelection'

// Style and UI components
export { StyleSelector, RENOVATION_STYLES, getStyleById, getStylePromptModifier, type RenovationStyle } from './StyleSelector'
export { SwipeableCards, WidgetCard, StatCard } from './SwipeableCards'

// Session and auth
export { SessionProvider, useSession, useAuthCheck } from './SessionHandler'

// Progress tracking
export { ProjectProgress, ProjectTimeline, useProjectProgress, type ProjectStage } from './ProjectProgress'

// AR and measurement features
export { ARCameraMode } from './ARCameraMode'
export { MeasurementsOverlay } from './MeasurementsOverlay'
