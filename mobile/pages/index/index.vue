<template>
  <view class="app-container">
    <view class="ai-input-wrapper">
      <view class="ai-box">
        <input v-model="aiPrompt" class="ai-input" placeholder="给 AI 说：明天下午3点开会..." confirm-type="send" @confirm="handleAISend" />
        <button class="ai-send-btn" :loading="isAILoading" @tap="handleAISend">发送</button>
      </view>
    </view>

    <scroll-view scroll-y class="todo-scroll" refresher-enabled :refresher-triggered="isRefreshing" @refresherrefresh="onRefresh">
      <view v-if="filteredTodos.length === 0" class="empty-state">
        <text class="empty-text">暂无待办，对 AI 说一句话吧</text>
      </view>
      <view v-for="item in filteredTodos" :key="item.id" class="todo-card" :class="{ completed: item.completed }">
        <view class="checkbox" @tap="toggleTodo(item)">
          <text v-if="item.completed" class="check-icon">✓</text>
        </view>
        <view class="todo-content" @tap="toggleTodo(item)">
          <text class="todo-title" :class="{ strike: item.completed }">{{ item.title }}</text>
          <view class="todo-meta">
            <text class="priority-tag">{{ item.priority }}</text>
            <text class="category-tag">{{ item.category }}</text>
            <text v-if="item.dueDate" class="due-date">{{ item.dueDate }}</text>
          </view>
        </view>
        <view class="delete-btn" @tap="deleteTodo(item.id)">×</view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { fetchTodoList, toggleTodoStatus, sendAIIntent, deleteTodoItem } from '@/api/todo';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  priority: string;
  category: string;
  dueDate: string | null;
}

const todos = ref<Todo[]>([]);
const aiPrompt = ref('');
const isAILoading = ref(false);
const isRefreshing = ref(false);

const filteredTodos = computed(() => todos.value);

const loadTodos = async () => {
  const res = await fetchTodoList();
  todos.value = res.data || [];
};

const toggleTodo = async (item: Todo) => {
  // #ifdef APP-PLUS
  uni.vibrateShort({});
  // #endif
  item.completed = !item.completed;
  try {
    await toggleTodoStatus(item.id);
  } catch {
    item.completed = !item.completed;
    uni.showToast({ title: '同步失败', icon: 'none' });
  }
};

const handleAISend = async () => {
  if (!aiPrompt.value.trim() || isAILoading.value) return;
  isAILoading.value = true;
  const prompt = aiPrompt.value;
  aiPrompt.value = '';
  try {
    const res = await sendAIIntent(prompt);
    uni.showToast({ title: res.aiResult?.message || 'AI 已执行', icon: 'success' });
    await loadTodos();
  } catch {
    uni.showToast({ title: 'AI 失败', icon: 'none' });
  } finally {
    isAILoading.value = false;
  }
};

const deleteTodo = async (id: string) => {
  await deleteTodoItem(id);
  todos.value = todos.value.filter((t) => t.id !== id);
};

const onRefresh = async () => {
  isRefreshing.value = true;
  await loadTodos();
  isRefreshing.value = false;
};

onMounted(loadTodos);
</script>

<style scoped>
.app-container { display: flex; flex-direction: column; height: 100vh; background: #f8fafc; }
.ai-input-wrapper { padding: 12px 16px; background: #fff; border-bottom: 1px solid #f1f5f9; }
.ai-box { display: flex; align-items: center; background: #f1f5f9; border-radius: 12px; padding: 6px 12px; }
.ai-input { flex: 1; font-size: 14px; margin: 0 8px; }
.ai-send-btn { background: #4f46e5; color: #fff; font-size: 12px; padding: 4px 12px; border-radius: 8px; }
.todo-scroll { flex: 1; }
.todo-card { display: flex; align-items: center; margin: 8px 16px; padding: 14px; background: #fff; border-radius: 12px; }
.strike { text-decoration: line-through; color: #94a3b8; }
.checkbox { width: 22px; height: 22px; border: 2px solid #cbd5e1; border-radius: 6px; margin-right: 12px; display: flex; align-items: center; justify-content: center; }
.check-icon { color: #4f46e5; font-weight: 700; }
.todo-content { flex: 1; }
.todo-meta { display: flex; gap: 8px; font-size: 11px; color: #64748b; margin-top: 4px; }
.delete-btn { color: #ef4444; font-size: 22px; padding: 0 8px; }
.empty-state { padding: 48px 16px; text-align: center; color: #94a3b8; }
</style>
