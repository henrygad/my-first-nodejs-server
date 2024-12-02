const router = require('express').Router()
const usersData = require('../schema/usersDataSchema')
const blogpostsData = require('../schema/blogpostsSchema')
const { customError } = require('../middlewares/error')

router.get('/search', async (req, res, next) => {
    const { query: { title = '', body = '', catigory = '', userName = '', name = '', skip = 0, limit = 0 }, session } = req

    const blogpostConditions = [] // search conditions logic array varible for blogposts
    if (title) blogpostConditions.push({ 'title': { $regex: title, $options: 'i' } }) // search by title 
    if (body) blogpostConditions.push({ 'body': { $regex: body, $options: 'i' } }) // search by body 
    if (catigory) blogpostConditions.push({ 'catigories': { $regex: catigory, $options: 'i' } }) // search by catigories 

    const userConditions = [] // search conditions logic array varible for users
    const getUserName = userName.startsWith('@') ? userName : '@' + userName // add @ if the username search query has none
    if (userName) userConditions.push({ 'userName': { $regex: getUserName, $options: 'i' } }) // userName search logic
    if (name) userConditions.push({ 'name': { $regex: name, $options: 'i' } }) // name search logic

    try {

        if (!blogpostConditions.length &&
            !userConditions.length) throw new Error('Bad request: epmty field search query provided')

        const searchedBlogposts = await blogpostsData // search through all blogpost and return search result
            .find({ $or: blogpostConditions, status: 'published' })
            .skip(skip)
            .limit(limit)

        const searchedUsers = await usersData // search through all users and return search result
            .find({ $or: userConditions })
            .skip(skip)
            .limit(limit)
            .select('userName name displayImage')

        if (!searchedBlogposts.length &&
            !searchedUsers.length) throw new Error('not found: no search result found')

        const searchQuery = (title || body || catigory || userName || name)
        const preSearchedQueries = session.searchHistory?.map(item => item.searched)
        if (!preSearchedQueries?.includes(searchQuery)) {
            session.searchHistory?.push({
                _id: Date.now().toString(),
                searched: searchQuery
            })
        }

        res.json({ // send successful search result
            userSearchResults: searchedUsers,
            blogpostSearchResult: searchedBlogposts,
            searchHistory: session.searchHistory?.reverse()
        })

    } catch (error) {
        next(new customError(error, 404))
    }
})

router.delete('/search/delete/history/:_ids', async (req, res, next) => {
    const { params: { _ids = [] }, session } = req

    try {
        if (!session?.searchHistory?.length ||
            !_ids
        ) throw new Error('Bad request: history is empty or invalid search history _id ')

        const arrOfIds = _ids.split('&') // covert ids to array of search history _id
        const deleteSearchHistory = (_id) => { // delete  search history
            session.searchHistory = session.searchHistory.filter(item => item._id !== _id)
        }
        arrOfIds?.map(item => { //delete each search history
            deleteSearchHistory(item)
        })

        res.json(session.searchHistory)

    } catch (error) {

        next(new customError(error, 404))
    }
})

module.exports = router
