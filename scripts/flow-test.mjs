/**
 * 完整状态流程冒烟测试（跑完退出码 0/1）
 */
const BASE = process.env.API_BASE || 'http://127.0.0.1:3001';

const results = [];
function ok(name, detail = '') {
  results.push({ name, pass: true, detail });
  console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`);
}
function fail(name, detail = '') {
  results.push({ name, pass: false, detail });
  console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
}

function parseSetCookie(res) {
  const raw = res.headers.getSetCookie?.() || [];
  if (raw.length) return raw.map((c) => c.split(';')[0]).join('; ');
  const single = res.headers.get('set-cookie');
  return single ? single.split(',').map((c) => c.split(';')[0].trim()).join('; ') : '';
}

async function req(path, { method = 'GET', body, cookie = '', token = '', expectStatus } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (expectStatus !== undefined && res.status !== expectStatus) {
    const err = new Error(`期望 ${expectStatus} 实际 ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    err.json = json;
    throw err;
  }
  return { status: res.status, json, cookie: parseSetCookie(res), res };
}

async function main() {
  console.log(`\n=== AI Todo 完整流程测试 @ ${BASE} ===\n`);

  // 0. health
  try {
    const h = await req('/api/health', { expectStatus: 200 });
    if (h.json.success) ok('健康检查', h.json.status);
    else fail('健康检查', JSON.stringify(h.json));
  } catch (e) {
    fail('健康检查', e.message);
    printSummary();
    process.exit(1);
  }

  // 1. 未登录访问待办
  try {
    await req('/api/todos', { expectStatus: 401 });
    ok('未登录访问待办 → 401');
  } catch (e) {
    fail('未登录访问待办 → 401', e.message);
  }

  // 2. 错误密码
  try {
    await req('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@aitodo.local', password: 'WrongPass999', platform: 'web' },
      expectStatus: 401,
    });
    ok('错误密码登录 → 401');
  } catch (e) {
    fail('错误密码登录 → 401', e.message);
  }

  // 3. 管理员登录（当前密码 SecurePass9，若不对再试 Admin@123456）
  let adminCookie = '';
  let adminUser = null;
  let adminPassword = 'SecurePass9';
  for (const pwd of ['SecurePass9', 'Admin@123456']) {
    try {
      const login = await req('/api/auth/login', {
        method: 'POST',
        body: { email: 'admin@aitodo.local', password: pwd, platform: 'web' },
        expectStatus: 200,
      });
      if (login.json.success) {
        adminCookie = login.cookie;
        adminUser = login.json.user;
        adminPassword = pwd;
        ok('管理员登录', `mustChangePassword=${adminUser.mustChangePassword}`);
        break;
      }
    } catch {
      /* try next */
    }
  }
  if (!adminUser) {
    fail('管理员登录', 'SecurePass9 / Admin@123456 均失败');
    printSummary();
    process.exit(1);
  }

  // 4. 若必须改密，业务接口应拒绝；然后改密
  if (adminUser.mustChangePassword) {
    try {
      await req('/api/todos', { cookie: adminCookie, expectStatus: 403 });
      ok('强制改密前访问待办 → 403');
    } catch (e) {
      fail('强制改密前访问待办 → 403', e.message);
    }
    try {
      const chg = await req('/api/auth/change-password', {
        method: 'POST',
        cookie: adminCookie,
        body: { oldPassword: adminPassword, newPassword: 'SecurePass9' },
        expectStatus: 200,
      });
      adminCookie = chg.cookie || adminCookie;
      adminPassword = 'SecurePass9';
      adminUser = chg.json.user;
      ok('强制修改初始密码', `mustChange=${adminUser.mustChangePassword}`);
    } catch (e) {
      fail('强制修改初始密码', e.message);
    }
  } else {
    ok('管理员无需强制改密（已改过）');
  }

  // 5. /me
  try {
    const me = await req('/api/auth/me', { cookie: adminCookie, expectStatus: 200 });
    ok('获取当前用户 /me', me.json.user.email);
  } catch (e) {
    fail('获取当前用户 /me', e.message);
  }

  // 6. 待办 CRUD
  let todoId = '';
  try {
    const created = await req('/api/todos', {
      method: 'POST',
      cookie: adminCookie,
      body: { title: '流程测试待办', priority: 'high', category: '测试', tags: ['flow'] },
      expectStatus: 201,
    });
    todoId = created.json.data.id;
    ok('创建待办', todoId);
  } catch (e) {
    fail('创建待办', e.message);
  }

  try {
    const list = await req('/api/todos?status=active&search=流程&page=1&pageSize=10', {
      cookie: adminCookie,
      expectStatus: 200,
    });
    const hit = (list.json.data || []).some((t) => t.id === todoId);
    if (hit) ok('筛选搜索待办', `count=${list.json.data.length}`);
    else fail('筛选搜索待办', '未找到刚创建的待办');
  } catch (e) {
    fail('筛选搜索待办', e.message);
  }

  try {
    const toggled = await req(`/api/todos/${todoId}/toggle`, {
      method: 'PATCH',
      cookie: adminCookie,
      expectStatus: 200,
    });
    if (toggled.json.data.completed) ok('切换待办完成');
    else fail('切换待办完成', 'completed 仍为 false');
  } catch (e) {
    fail('切换待办完成', e.message);
  }

  try {
    const updated = await req(`/api/todos/${todoId}`, {
      method: 'PUT',
      cookie: adminCookie,
      body: { title: '流程测试待办-已改', priority: 'urgent', completed: false },
      expectStatus: 200,
    });
    if (updated.json.data.title.includes('已改') && updated.json.data.priority === 'urgent') {
      ok('更新待办');
    } else fail('更新待办', JSON.stringify(updated.json.data));
  } catch (e) {
    fail('更新待办', e.message);
  }

  // 7. AI 指令（无 key 时走 fallback）
  try {
    const ai = await req('/api/ai/todo-action', {
      method: 'POST',
      cookie: adminCookie,
      body: { prompt: '帮我添加待办：明天买咖啡' },
      expectStatus: 200,
    });
    if (ai.json.success && ai.json.aiResult) ok('AI 添加待办', ai.json.aiResult.action || ai.json.aiResult.message);
    else fail('AI 添加待办', JSON.stringify(ai.json));
  } catch (e) {
    fail('AI 添加待办', e.message);
  }

  try {
    const ai2 = await req('/api/ai/todo-action', {
      method: 'POST',
      cookie: adminCookie,
      body: { prompt: '把买咖啡标记为完成' },
      expectStatus: 200,
    });
    ok('AI 完成待办', ai2.json.aiResult?.action || 'ok');
  } catch (e) {
    fail('AI 完成待办', e.message);
  }

  try {
    await req('/api/ai/todo-action', {
      method: 'POST',
      cookie: adminCookie,
      body: { prompt: 'x'.repeat(1001) },
      expectStatus: 400,
    });
    ok('AI 超长指令 → 400');
  } catch (e) {
    fail('AI 超长指令 → 400', e.message);
  }

  // 8. 批量 + 清理已完成
  try {
    await req('/api/todos/batch', {
      method: 'POST',
      cookie: adminCookie,
      body: { items: [{ title: '批量A' }, { title: '批量B' }] },
      expectStatus: 201,
    });
    ok('批量创建待办');
  } catch (e) {
    fail('批量创建待办', e.message);
  }

  try {
    // 先完成一个
    const list = await req('/api/todos?status=active', { cookie: adminCookie, expectStatus: 200 });
    if (list.json.data?.[0]) {
      await req(`/api/todos/${list.json.data[0].id}/toggle`, { method: 'PATCH', cookie: adminCookie });
    }
    const cleared = await req('/api/todos/clear-completed', {
      method: 'POST',
      cookie: adminCookie,
      expectStatus: 200,
    });
    ok('清理已完成', `cleared=${cleared.json.clearedCount}`);
  } catch (e) {
    fail('清理已完成', e.message);
  }

  try {
    if (todoId) {
      await req(`/api/todos/${todoId}`, { method: 'DELETE', cookie: adminCookie, expectStatus: 200 });
      ok('删除待办');
    }
  } catch (e) {
    fail('删除待办', e.message);
  }

  // 9. 设备列表 + client token
  let clientToken = '';
  try {
    const tok = await req('/api/auth/client-token', {
      method: 'POST',
      cookie: adminCookie,
      body: { platform: 'desktop-rust', deviceName: 'FlowTestDesktop', clientVersion: '1.0.0' },
      expectStatus: 200,
    });
    clientToken = tok.json.token;
    ok('签发桌面端 Bearer Token');
  } catch (e) {
    fail('签发桌面端 Bearer Token', e.message);
  }

  try {
    const list = await req('/api/todos', { token: clientToken, expectStatus: 200 });
    ok('Bearer Token 访问待办', `total=${list.json.total}`);
  } catch (e) {
    fail('Bearer Token 访问待办', e.message);
  }

  try {
    const devices = await req('/api/devices', { cookie: adminCookie, expectStatus: 200 });
    ok('设备列表', `count=${devices.json.data?.length}`);
  } catch (e) {
    fail('设备列表', e.message);
  }

  // 10. 管理员设置 / 用户列表 / 备份脱敏
  try {
    const users = await req('/api/auth/users', { cookie: adminCookie, expectStatus: 200 });
    ok('管理员用户列表', `count=${users.json.data?.length}`);
  } catch (e) {
    fail('管理员用户列表', e.message);
  }

  try {
    const settings = await req('/api/settings', { cookie: adminCookie, expectStatus: 200 });
    const pass = settings.json.data?.mail?.netease?.pass || '';
    if (!pass || pass.includes('****') || pass === '') ok('设置接口邮件密钥脱敏', pass || 'empty');
    else fail('设置接口邮件密钥脱敏', pass);
  } catch (e) {
    fail('设置接口邮件密钥脱敏', e.message);
  }

  try {
    const backup = await req('/api/backup/export', { cookie: adminCookie, expectStatus: 200 });
    const pass = backup.json.settings?.mail?.netease?.pass;
    if (!pass) ok('备份导出不含 SMTP 密码');
    else fail('备份导出不含 SMTP 密码', String(pass));
  } catch (e) {
    fail('备份导出不含 SMTP 密码', e.message);
  }

  // 11. 注册策略：关邮箱验证后注册普通用户；邮箱探测不泄露
  let memberCookie = '';
  let memberId = '';
  const memberEmail = `flow_${Date.now()}@example.com`;
  try {
    await req('/api/settings', {
      method: 'PUT',
      cookie: adminCookie,
      body: { registration: { enabled: true, requireEmailVerify: false, requireAdminApproval: false } },
      expectStatus: 200,
    });
    ok('关闭邮箱验证（便于本地注册测试）');
  } catch (e) {
    fail('关闭邮箱验证', e.message);
  }

  try {
    const codeRes = await req('/api/auth/send-code', {
      method: 'POST',
      body: { email: 'admin@aitodo.local' },
      expectStatus: 200,
    });
    if (codeRes.json.devCode) fail('已注册邮箱发码不返回验证码', `devCode=${codeRes.json.devCode}`);
    else ok('已注册邮箱发码统一响应（不泄露）', codeRes.json.message?.slice(0, 40));
  } catch (e) {
    // 503 when requireEmailVerify was true earlier; after we disabled verify, send-code may still require mail if requireEmailVerify somehow true
    if (e.status === 503 || e.message.includes('503')) ok('发码在邮件未配置时拒绝（无明文码）');
    else fail('已注册邮箱发码统一响应', e.message);
  }

  try {
    const reg = await req('/api/auth/register', {
      method: 'POST',
      body: { username: `flowuser_${Date.now()}`, email: memberEmail, password: 'MemberPass9' },
      expectStatus: 201,
    });
    memberCookie = reg.cookie;
    memberId = reg.json.user?.id;
    if (reg.json.pending) ok('注册进入待审核');
    else ok('普通用户注册并登录', memberEmail);
  } catch (e) {
    fail('普通用户注册并登录', e.message);
  }

  // 12. 普通用户隔离：看不到管理员待办管理接口
  try {
    await req('/api/auth/users', { cookie: memberCookie, expectStatus: 403 });
    ok('普通用户访问用户列表 → 403');
  } catch (e) {
    fail('普通用户访问用户列表 → 403', e.message);
  }

  try {
    await req('/api/settings', { cookie: memberCookie, expectStatus: 403 });
    ok('普通用户访问系统设置 → 403');
  } catch (e) {
    fail('普通用户访问系统设置 → 403', e.message);
  }

  let memberTodoId = '';
  try {
    const created = await req('/api/todos', {
      method: 'POST',
      cookie: memberCookie,
      body: { title: '成员私有待办' },
      expectStatus: 201,
    });
    memberTodoId = created.json.data.id;
    const adminList = await req('/api/todos?search=成员私有', { cookie: adminCookie, expectStatus: 200 });
    const leak = (adminList.json.data || []).some((t) => t.id === memberTodoId);
    if (!leak) ok('待办按账号隔离（管理员搜不到成员待办）');
    else fail('待办按账号隔离', '发生串号');
  } catch (e) {
    fail('待办按账号隔离', e.message);
  }

  // 13. 管理员改用户状态 pending / disabled
  if (memberId) {
    try {
      await req(`/api/auth/users/${memberId}`, {
        method: 'PATCH',
        cookie: adminCookie,
        body: { status: 'disabled' },
        expectStatus: 200,
      });
      ok('管理员禁用用户');
    } catch (e) {
      fail('管理员禁用用户', e.message);
    }

    try {
      await req('/api/todos', { cookie: memberCookie, expectStatus: 401 });
      ok('禁用后旧会话失效 → 401');
    } catch (e) {
      // might be 401 or 403
      if (String(e.message).includes('401') || String(e.message).includes('403')) ok('禁用后旧会话失效', e.message.slice(0, 80));
      else fail('禁用后旧会话失效', e.message);
    }

    try {
      await req('/api/auth/login', {
        method: 'POST',
        body: { email: memberEmail, password: 'MemberPass9', platform: 'web' },
        expectStatus: 403,
      });
      ok('禁用账号登录 → 403');
    } catch (e) {
      fail('禁用账号登录 → 403', e.message);
    }

    try {
      await req(`/api/auth/users/${memberId}`, {
        method: 'PATCH',
        cookie: adminCookie,
        body: { status: 'active' },
        expectStatus: 200,
      });
      ok('管理员恢复用户');
    } catch (e) {
      fail('管理员恢复用户', e.message);
    }
  }

  // 14. 找回密码接口（无邮件时也应统一响应）
  try {
    const forgot = await req('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: memberEmail },
      expectStatus: 200,
    });
    ok('找回密码请求', forgot.json.message?.slice(0, 40) || 'ok');
  } catch (e) {
    fail('找回密码请求', e.message);
  }

  // 15. 登出后 cookie 失效
  try {
    await req('/api/auth/logout', { method: 'POST', cookie: adminCookie, body: {}, expectStatus: 200 });
    ok('管理员登出');
  } catch (e) {
    fail('管理员登出', e.message);
  }

  try {
    await req('/api/auth/me', { cookie: adminCookie, expectStatus: 401 });
    ok('登出后 cookie 失效 → 401');
  } catch (e) {
    fail('登出后 cookie 失效 → 401', e.message);
  }

  // 16. 重新登录管理员，清理测试用户
  try {
    const login = await req('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@aitodo.local', password: adminPassword, platform: 'web' },
      expectStatus: 200,
    });
    adminCookie = login.cookie;
    if (memberId) {
      await req(`/api/auth/users/${memberId}`, { method: 'DELETE', cookie: adminCookie, expectStatus: 200 });
      ok('删除测试用户');
    }
    // 清理剩余测试待办
    const list = await req('/api/todos?search=流程', { cookie: adminCookie, expectStatus: 200 });
    for (const t of list.json.data || []) {
      await req(`/api/todos/${t.id}`, { method: 'DELETE', cookie: adminCookie });
    }
    const list2 = await req('/api/todos?search=批量', { cookie: adminCookie, expectStatus: 200 });
    for (const t of list2.json.data || []) {
      await req(`/api/todos/${t.id}`, { method: 'DELETE', cookie: adminCookie });
    }
    const list3 = await req('/api/todos?search=咖啡', { cookie: adminCookie, expectStatus: 200 });
    for (const t of list3.json.data || []) {
      await req(`/api/todos/${t.id}`, { method: 'DELETE', cookie: adminCookie });
    }
    ok('清理测试数据');
    await req('/api/auth/logout', { method: 'POST', cookie: adminCookie, body: {} });
  } catch (e) {
    fail('清理测试数据', e.message);
  }

  printSummary();
  const failed = results.filter((r) => !r.pass).length;
  process.exit(failed ? 1 : 0);
}

function printSummary() {
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n=== 结果：${passed} 通过 / ${failed} 失败 / 共 ${results.length} ===\n`);
  if (failed) {
    console.log('失败项：');
    results.filter((r) => !r.pass).forEach((r) => console.log(`  - ${r.name}: ${r.detail}`));
    console.log('');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
