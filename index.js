var axios = require("axios")
var express = require("express")
var app = express()

// update github
var updateGitHubRes = function(blob, path) {
  var commitSha
  var commitTreeSha
  return getRef()
    .then(({ data }) => {
      commitSha = data.object.sha
      return getCommit(commitSha)
    })
    .then(({ data }) => {
      commitTreeSha = data.tree.sha
      return createBlob(blob)
    })
    .then(({ data }) => {
      var blobSha = data.sha
      return createTree(commitTreeSha, path, blobSha)
    })
    .then(({ data }) => {
      var treeSha = data.sha
      return createCommit(commitSha, treeSha)
    })
    .then(({ data }) => {
      var newCommitSha = data.sha
      return updataRef(newCommitSha)
    })
    .catch(err => {
      console.log(err)
    })
}

var getRef = function() {
  return axios.get(`/${owner}/${repo}/git/refs/heads/master`)
}

var getCommit = function(commitSha) {
  return axios.get(`/${owner}/${repo}/git/commits/${commitSha}`)
}

var createBlob = function(content) {
  return axios.post(`/${owner}/${repo}/git/blobs`, {
    content,
    encoding: 'utf-8'
  })
}

var createTree = function(base_tree, path, sha) {
  return axios.post(`/${owner}/${repo}/git/trees`, {
    base_tree, // commit tree 的 sha
    tree: [
      {
        path, // 文件路径
        mode: '100644', // 类型，详情看文档
        type: 'blob',
        sha // 刚才生成的 blob 的 sha
      }
    ]
  })
}

var createCommit = function(
  parentCommitSha,
  tree,
  message = ':memo: update post'
) {
  return axios.post(`/${owner}/${repo}/git/commits`, {
    message,
    parents: [parentCommitSha],
    tree
  })
}

var updataRef = function(newCommitSha) {
  return axios.post(`/${owner}/${repo}/git/refs/heads/master`, {
    sha: newCommitSha,
    force: true
  })
}

// post yuque
app.post('/yuque/webhook', function(req, res) {
  console.log('web hook')
  var postData = req.body.data
  if (!postData) {
    console.log('nothing append')
    return res.json({
      msg: 'nothing append'
    })
  }
  var title = postData.title
  var date = postData.created_at
  var content = postData.body

  var tagsReg = new RegExp(/(?<=<tags>).*(?=<\/tags>)/)
  var removeTagsReg = new RegExp(/<tags>.*<\/tags>/)
  var pathReg = new RegExp(/(?<=<path>).*(?=<\/path>)/)
  var removePathReg = new RegExp(/<path>.*<\/path>/)
  var replaceBrReg = new RegExp(/<br \/>/g)

  var tags = content.match(tagsReg)
  content = content.replace(removeTagsReg, '')
  var postPath = content.match(pathReg)
  content = content.replace(removePathReg, '')
  content = content.replace(replaceBrReg, '\n')

  tags = tags && tags[0]
  postPath = postPath && postPath[0]
  var tagsString = JSON.stringify(tags.split(','))

  var contentHeader = `---
      path: "${postPath}"
      date: "${date}"
      title: "${title}"
      tags: ${tagsString}
    ---`

  updateGitHubRes(
    contentHeader + content,
    `src/pages/${date.substring(0, 10)}-${postPath.substring(1)}/index.md`
  ).then(({ data }) => {
    console.log('finish')
    return res.json({
      msg: 'finish'
    })
  })
})

var PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Our app is running on port ${ PORT }`);
});
