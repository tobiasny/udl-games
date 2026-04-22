import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './use-auth'

export interface RebusTask {
  id: string
  sort_order: number
  title: string
  description: string
  task_type: 'answer' | 'activity'
  correct_answer: string | null
  destination_coords: string | null
  destination_name: string | null
  status: 'locked' | 'active' | 'submitted' | 'approved' | 'completed' | 'rejected'
  submitted_answer: string | null
  created_at: string
}

export interface RebusSettings {
  start_coords: string | null
  start_name: string | null
}

export function useRebus() {
  const [tasks, setTasks] = useState<RebusTask[]>([])
  const [settings, setSettings] = useState<RebusSettings>({ start_coords: null, start_name: null })
  const [loading, setLoading] = useState(true)
  const { sessionToken } = useAuth()

  const fetchTasks = useCallback(async () => {
    const [tasksRes, settingsRes] = await Promise.all([
      supabase.from('rebus_tasks').select('*').order('sort_order'),
      supabase.from('rebus_settings').select('start_coords, start_name').eq('id', 1).maybeSingle(),
    ])
    if (!tasksRes.error && tasksRes.data) setTasks(tasksRes.data)
    if (!settingsRes.error && settingsRes.data) {
      setSettings({
        start_coords: settingsRes.data.start_coords,
        start_name: settingsRes.data.start_name,
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // Bachelor: submit answer
  const submitAnswer = async (taskId: string, answer: string) => {
    const { error } = await supabase.rpc('rebus_submit_answer', {
      task_id_input: taskId,
      answer_input: answer,
    })
    if (error) throw error
    await fetchTasks()
  }

  // Admin: approve task
  const approveTask = async (taskId: string) => {
    const { error } = await supabase.rpc('rebus_approve_task', {
      token_input: sessionToken,
      task_id_input: taskId,
    })
    if (error) throw error
    await fetchTasks()
  }

  // Admin: reject a submitted answer. Parks the task in 'rejected' so the
  // bachelor's view can show the "wrong answer, take a shot" screen.
  const rejectAnswer = async (taskId: string) => {
    const { error } = await supabase.rpc('rebus_reject_answer', {
      token_input: sessionToken,
      task_id_input: taskId,
    })
    if (error) throw error
    await fetchTasks()
  }

  // Bachelor: retry a rejected answer task. Flips it back to active so the
  // answer form re-appears. Public RPC -- no admin token needed.
  const retryTask = async (taskId: string) => {
    const { error } = await supabase.rpc('rebus_retry_task', {
      task_id_input: taskId,
    })
    if (error) throw error
    await fetchTasks()
  }

  // Admin: mark arrived
  const markArrived = async (taskId: string) => {
    const { error } = await supabase.rpc('rebus_mark_arrived', {
      token_input: sessionToken,
      task_id_input: taskId,
    })
    if (error) throw error
    await fetchTasks()
  }

  // Admin: add task. The destination_name column is left in the schema for
  // historical reasons but is no longer surfaced in the UI -- always pass
  // null so existing rows aren't accidentally repopulated.
  const addTask = async (
    title: string,
    description: string,
    taskType: 'answer' | 'activity',
    correctAnswer?: string,
    destinationCoords?: string,
  ) => {
    const { error } = await supabase.rpc('rebus_add_task', {
      token_input: sessionToken,
      title_input: title,
      description_input: description,
      task_type_input: taskType,
      correct_answer_input: correctAnswer ?? null,
      destination_coords_input: destinationCoords ?? null,
      destination_name_input: null,
    })
    if (error) throw error
    await fetchTasks()
  }

  // Admin: update task
  const updateTask = async (
    taskId: string,
    title: string,
    description: string,
    taskType: 'answer' | 'activity',
    correctAnswer?: string,
    destinationCoords?: string,
  ) => {
    const { error } = await supabase.rpc('rebus_update_task', {
      token_input: sessionToken,
      task_id_input: taskId,
      title_input: title,
      description_input: description,
      task_type_input: taskType,
      correct_answer_input: correctAnswer ?? null,
      destination_coords_input: destinationCoords ?? null,
      destination_name_input: null,
    })
    if (error) throw error
    await fetchTasks()
  }

  // Admin: delete task
  const deleteTask = async (taskId: string) => {
    const { error } = await supabase.rpc('rebus_delete_task', {
      token_input: sessionToken,
      task_id_input: taskId,
    })
    if (error) throw error
    await fetchTasks()
  }

  // Admin: reset all
  const resetAll = async () => {
    const { error } = await supabase.rpc('rebus_reset_all', {
      token_input: sessionToken,
    })
    if (error) throw error
    await fetchTasks()
  }

  // Admin: reorder tasks
  const reorderTasks = async (orderedIds: string[]) => {
    const { error } = await supabase.rpc('reorder_rebus_tasks', {
      token_input: sessionToken,
      ordered_ids: orderedIds,
    })
    if (error) throw error
    await fetchTasks()
  }

  // Admin: reset single task
  const resetTask = async (taskId: string) => {
    const { error } = await supabase.rpc('rebus_reset_task', {
      token_input: sessionToken,
      task_id_input: taskId,
    })
    if (error) throw error
    await fetchTasks()
  }

  // Admin: set start coordinates for the route. The accompanying name field
  // is no longer collected from the UI -- pass null so the column stays
  // empty and the schema isn't broken.
  const setStart = async (startCoords: string) => {
    const { error } = await supabase.rpc('rebus_set_start', {
      token_input: sessionToken,
      start_coords_input: startCoords,
      start_name_input: null,
    })
    if (error) throw error
    await fetchTasks()
  }

  return {
    tasks,
    settings,
    loading,
    submitAnswer,
    approveTask,
    rejectAnswer,
    retryTask,
    markArrived,
    addTask,
    updateTask,
    deleteTask,
    resetAll,
    resetTask,
    reorderTasks,
    setStart,
    refetch: fetchTasks,
  }
}
