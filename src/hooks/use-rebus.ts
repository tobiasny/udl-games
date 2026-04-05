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
  status: 'locked' | 'active' | 'submitted' | 'approved' | 'completed'
  submitted_answer: string | null
  created_at: string
}

export function useRebus() {
  const [tasks, setTasks] = useState<RebusTask[]>([])
  const [loading, setLoading] = useState(true)
  const { sessionToken } = useAuth()

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('rebus_tasks')
      .select('*')
      .order('sort_order')
    if (!error && data) setTasks(data)
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

  // Admin: mark arrived
  const markArrived = async (taskId: string) => {
    const { error } = await supabase.rpc('rebus_mark_arrived', {
      token_input: sessionToken,
      task_id_input: taskId,
    })
    if (error) throw error
    await fetchTasks()
  }

  // Admin: add task
  const addTask = async (
    title: string,
    description: string,
    taskType: 'answer' | 'activity',
    correctAnswer?: string,
    destinationCoords?: string,
    destinationName?: string,
  ) => {
    const { error } = await supabase.rpc('rebus_add_task', {
      token_input: sessionToken,
      title_input: title,
      description_input: description,
      task_type_input: taskType,
      correct_answer_input: correctAnswer ?? null,
      destination_coords_input: destinationCoords ?? null,
      destination_name_input: destinationName ?? null,
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
    destinationName?: string,
  ) => {
    const { error } = await supabase.rpc('rebus_update_task', {
      token_input: sessionToken,
      task_id_input: taskId,
      title_input: title,
      description_input: description,
      task_type_input: taskType,
      correct_answer_input: correctAnswer ?? null,
      destination_coords_input: destinationCoords ?? null,
      destination_name_input: destinationName ?? null,
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

  // Admin: reset single task
  const resetTask = async (taskId: string) => {
    const { error } = await supabase.rpc('rebus_reset_task', {
      token_input: sessionToken,
      task_id_input: taskId,
    })
    if (error) throw error
    await fetchTasks()
  }

  return {
    tasks,
    loading,
    submitAnswer,
    approveTask,
    markArrived,
    addTask,
    updateTask,
    deleteTask,
    resetAll,
    resetTask,
    refetch: fetchTasks,
  }
}
