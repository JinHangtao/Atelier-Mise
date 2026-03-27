export type ProjectStatus = 'planning' | 'in-progress' | 'completed' | 'on-hold'

export type ProjectCategory = 'school' | 'personal' | 'commission' | 'experiment'

export type MilestoneStatus = 'pending' | 'done'

export type NoteVisibility = 'private' | 'group' | 'professor'

export interface Milestone {
  id: string
  title: string
  date: string
  note?: string
  status: MilestoneStatus
}

export interface Proposal {
  id: string
  content: string
  createdAt: string
}

export interface Note {
  id: string
  content: string
  visibility: NoteVisibility
  createdAt: string
}

export interface Project {
  id: string
  title: string
  description: string
  category: ProjectCategory
  status: ProjectStatus
  tags: string[]
  startDate: string
  endDate?: string
  school?: string
  medium?: string
  mediaUrls?: string[]
  milestones: Milestone[]
  proposals: Proposal[]
  notes: Note[]
  createdAt: string
  updatedAt: string
}